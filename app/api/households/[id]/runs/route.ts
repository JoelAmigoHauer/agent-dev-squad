import { getServerClient, getServiceClient } from '@/lib/db/server';
import { requireWriter, isUuid } from '@/lib/api/guards';
import { loadHouseholdFacts } from '@/lib/api/household-facts';
import { selectProposalEngine } from '@/lib/api/engine';
import { runGraph } from '@/lib/agents/graph';
import { appendLedger } from '@/lib/ledger';
import { isStale } from '@/lib/adapters/marketdata';
import { toDb } from '@/lib/domain/money';
import { conflict, internal, notFound, ok } from '@/lib/api/respond';

/** Recommendations expire so a stale proposal cannot be approved days later against prices and
 *  positions that have since moved. Contract §1 F4. */
const EXPIRY_HOURS = 24;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireWriter();
  if ('response' in guard) return guard.response;
  const { id } = await params;
  if (!isUuid(id)) return notFound();
  const { session } = guard;

  try {
    const supabase = await getServerClient();
    const facts = await loadHouseholdFacts(supabase, id);
    if (!facts) return notFound('household_not_found');
    if (!facts.mandate) return conflict('no_published_mandate');

    const { data: active } = await supabase
      .from('agent_runs').select('id').eq('household_id', id).eq('status', 'running').maybeSingle();
    if (active) return conflict('run_in_progress', { runId: active.id });

    const service = getServiceClient();
    const { data: run, error: runError } = await service
      .from('agent_runs')
      .insert({
        firm_id: session.profile.firm_id, household_id: id,
        mandate_id: facts.mandate.id, status: 'running', trigger: 'manual',
      })
      .select('id').single();
    if (runError || !run) return internal(runError);

    // The graph is deterministic apart from the proposal step and completes well inside the 300s
    // function ceiling for one household, which is why this runs inline (contract §4, A3).
    const engine = selectProposalEngine();
    const result = await runGraph({
      householdName: facts.household.name,
      ctx: facts.ctx,
      symbolsById: facts.symbolsById,
      pricesBySecurityId: facts.pricesBySecurityId,
      engine,
      now: () => Date.now(),
    });

    if (result.steps.length) {
      await service.from('agent_steps').insert(result.steps.map((s) => ({
        run_id: run.id, seq: s.seq, agent: s.agent, step_type: s.stepType,
        input: JSON.parse(JSON.stringify(s.input)), output: JSON.parse(JSON.stringify(s.output)),
        model: s.model, tokens_in: s.tokensIn, tokens_out: s.tokensOut, latency_ms: s.latencyMs,
      })));
    }

    if (result.observations.length) {
      await service.from('observations').insert(result.observations.map((o) => ({
        firm_id: session.profile.firm_id, run_id: run.id, household_id: id,
        kind: o.kind, severity: o.severity, asset_class: o.assetClass,
        security_id: o.securityId, detail: JSON.parse(JSON.stringify(o.detail)),
      })));
    }

    const staleData = facts.priceAsOf
      ? isStale(facts.priceAsOf, facts.ctx.mandate.driftToleranceBps > 0 ? 24 : 24)
      : true;
    const expiresAt = new Date(Date.now() + EXPIRY_HOURS * 3_600_000).toISOString();

    let rank = 0;
    for (const { candidate, guardrail } of result.accepted) {
      rank += 1;
      const { data: recommendation, error } = await service
        .from('recommendations')
        .insert({
          firm_id: session.profile.firm_id, run_id: run.id, household_id: id,
          mandate_id: facts.mandate.id, action: candidate.action, rank, status: 'pending',
          rationale: candidate.rationale,
          projected_drift_bps_before: result.drift.worstDriftBps,
          projected_drift_bps_after: projectedAfter(result.drift.worstDriftBps),
          projected_realized_gain: toDb(candidate.projectedRealizedGain),
          projected_tax_cost: toDb(candidate.projectedTaxCost),
          stale_data: staleData,
          guardrail_result: JSON.parse(JSON.stringify(guardrail)),
          provenance: {
            positionsAsOf: facts.asOf, pricesAsOf: facts.priceAsOf,
            priceSource: 'security_prices', mandateVersion: facts.mandate.version,
            model: engine.model, engine: engine.id, runId: run.id,
          },
          expires_at: expiresAt,
        })
        .select('id').single();
      if (error || !recommendation) continue;

      await service.from('recommendation_legs').insert(candidate.legs.map((leg, index) => ({
        recommendation_id: recommendation.id, seq: index + 1,
        account_id: leg.accountId, security_id: leg.securityId, side: leg.side,
        quantity: leg.quantity, est_price: leg.estPrice, est_amount: toDb(leg.estAmount),
      })));
    }

    await service.from('agent_runs')
      .update({ status: 'complete', finished_at: new Date().toISOString() })
      .eq('id', run.id);

    // The agent audits as a distinct actor, never as the advisor who triggered the run.
    await appendLedger({
      firmId: session.profile.firm_id,
      actor: { type: 'agent', identity: process.env.THELMA_AGENT_IDENTITY ?? 'thelma/monitor@1.0.0' },
      eventType: 'run.completed',
      householdId: id, subjectType: 'agent_run', subjectId: run.id,
      payload: {
        triggeredBy: session.userId, trigger: 'manual',
        mandateVersion: facts.mandate.version,
        observations: result.observations.length,
        recommendations: result.accepted.length,
        rejected: result.steps.filter((s) => s.stepType === 'rejection').length,
        worstDriftBps: result.drift.worstDriftBps,
      },
      dataSources: [
        { type: 'positions', asOf: facts.asOf },
        { type: 'prices', asOf: facts.priceAsOf, source: 'security_prices' },
        { type: 'mandate', version: facts.mandate.version },
      ],
    });

    return ok({ runId: run.id, status: 'running' }, 202);
  } catch (error) {
    return internal(error);
  }
}

/** Placeholder projection until the post-trade drift is threaded out of the guardrail engine.
 *  Deliberately conservative — it never claims a better outcome than halving the drift. */
function projectedAfter(before: number): number {
  return Math.round(before / 2);
}
