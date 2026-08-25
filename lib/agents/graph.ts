/**
 * The agent graph — amendment A3: TypeScript, in Vercel Functions, no resident service.
 *
 * Five agents under a governance layer, run in a fixed order:
 *
 *   monitor    deterministic. Computes drift and writes observations.
 *   risk       deterministic. Band breaches and cash/liquidity shortfalls.
 *   tax        deterministic. Flags harvest candidates; never proposes in a sheltered account.
 *   proposal   the ONLY model step. Produces candidate legs and a rationale.
 *   guardrail  deterministic. Evaluates every candidate. Failures become `rejection` steps.
 *
 * "Governance layer" is not a metaphor here: `runGraph` is the only path that can create a
 * recommendation, and it cannot emit one that has not passed `evaluateGuardrails`.
 *
 * A whole cycle for one household is well inside the 300s function ceiling, which is why this
 * fits the default stack and trigger 2 does not fire (contract §4).
 */

import { evaluateGuardrails } from '@/lib/guardrails/engine';
import type { GuardrailContext } from '@/lib/guardrails/types';
import { computeDrift, type DriftReport } from '@/lib/domain/drift';
import { add, bpsOf, ZERO, type Money } from '@/lib/domain/money';
import type { Enums } from '@/lib/db/database.types';
import type { Candidate, ProposalEngine, ProposalInput } from './types';
import type { GuardrailResult } from '@/lib/guardrails/types';

export interface GraphStep {
  seq: number;
  agent: 'monitor' | 'risk' | 'tax' | 'proposal' | 'guardrail';
  stepType: 'tool_call' | 'reasoning' | 'decision' | 'rejection';
  input: unknown;
  output: unknown;
  model: string | null;
  tokensIn: number | null;
  tokensOut: number | null;
  latencyMs: number;
}

export interface GraphObservation {
  kind: Enums<'observation_kind'>;
  severity: Enums<'severity'>;
  assetClass: Enums<'asset_class'> | null;
  securityId: string | null;
  detail: Record<string, unknown>;
}

export interface GraphResult {
  drift: DriftReport;
  observations: GraphObservation[];
  accepted: { candidate: Candidate; guardrail: GuardrailResult }[];
  steps: GraphStep[];
}

export interface GraphInput {
  householdName: string;
  ctx: GuardrailContext;
  symbolsById: Map<string, string>;
  pricesBySecurityId: Map<string, number>;
  engine: ProposalEngine;
  now: () => number;
}

/** Cash is spread across a household's accounts and is a band member in its own right. */
function totalCash(ctx: GuardrailContext): Money {
  return add(...ctx.accounts.map((a) => a.cashBalance), ZERO);
}

export async function runGraph(input: GraphInput): Promise<GraphResult> {
  const steps: GraphStep[] = [];
  let seq = 0;
  const record = (step: Omit<GraphStep, 'seq'>) => steps.push({ seq: ++seq, ...step });

  const { ctx, engine } = input;

  // --- monitor -----------------------------------------------------------
  const t0 = input.now();
  const drift = computeDrift(
    ctx.positions.map((p) => ({
      assetClass: ctx.securities.find((s) => s.id === p.securityId)?.assetClass ?? 'other',
      marketValue: p.marketValue,
    })),
    ctx.mandate.bands,
    totalCash(ctx),
  );

  const observations: GraphObservation[] = [];
  for (const band of drift.bands) {
    if (Math.abs(band.driftBps) < ctx.mandate.driftToleranceBps && !band.breached) continue;
    observations.push({
      kind: 'allocation_drift',
      // Outside the band is critical; inside the band but past tolerance is a warning. The
      // advisor's triage depends on that distinction being made here, not in the UI.
      severity: band.breached ? 'critical' : 'warning',
      assetClass: band.assetClass,
      securityId: null,
      detail: {
        targetBps: band.targetBps, actualBps: band.actualBps, driftBps: band.driftBps,
        minBps: band.minBps, maxBps: band.maxBps,
        toleranceBps: ctx.mandate.driftToleranceBps, marketValue: band.marketValue,
      },
    });
  }
  record({
    agent: 'monitor', stepType: 'decision',
    input: { positions: ctx.positions.length, bands: ctx.mandate.bands.length },
    output: { totalMarketValue: drift.totalMarketValue, worstDriftBps: drift.worstDriftBps,
              anyBreached: drift.anyBreached, observations: observations.length },
    model: null, tokensIn: null, tokensOut: null, latencyMs: input.now() - t0,
  });

  // --- risk --------------------------------------------------------------
  const t1 = input.now();
  const cash = totalCash(ctx);
  const requiredCash = add(bpsOf(drift.totalMarketValue, ctx.mandate.minCashBps),
                           ctx.mandate.liquidityNeed);
  if (cash < requiredCash) {
    observations.push({
      kind: 'cash_event', severity: 'warning', assetClass: 'cash', securityId: null,
      detail: { cash, requiredCash, minCashBps: ctx.mandate.minCashBps,
                liquidityNeed: ctx.mandate.liquidityNeed },
    });
  }
  for (const band of drift.bands.filter((b) => b.breached)) {
    observations.push({
      kind: 'risk_breach', severity: 'critical', assetClass: band.assetClass, securityId: null,
      detail: { actualBps: band.actualBps, minBps: band.minBps, maxBps: band.maxBps },
    });
  }
  record({
    agent: 'risk', stepType: 'decision',
    input: { cash, requiredCash },
    output: { breaches: drift.bands.filter((b) => b.breached).map((b) => b.assetClass) },
    model: null, tokensIn: null, tokensOut: null, latencyMs: input.now() - t1,
  });

  // --- tax ---------------------------------------------------------------
  const t2 = input.now();
  const harvestCandidates = ctx.positions.filter((p) => {
    const account = ctx.accounts.find((a) => a.id === p.accountId);
    // Only taxable accounts. A loss inside an IRA is not deductible, so surfacing it as an
    // "opportunity" would invite the advisor to make a trade that achieves nothing.
    return account?.taxTreatment === 'taxable' && p.marketValue < p.costBasis;
  });
  for (const position of harvestCandidates) {
    observations.push({
      kind: 'tax_opportunity', severity: 'info', assetClass: null, securityId: position.securityId,
      detail: {
        accountId: position.accountId,
        unrealizedLoss: position.costBasis - position.marketValue,
        marketValue: position.marketValue, costBasis: position.costBasis,
        note: 'v1.0 flags the candidate only. Lot selection and wash-sale checking land in v1.1.',
      },
    });
  }
  record({
    agent: 'tax', stepType: 'decision',
    input: { positionsConsidered: ctx.positions.length },
    output: { harvestCandidates: harvestCandidates.length },
    model: null, tokensIn: null, tokensOut: null, latencyMs: input.now() - t2,
  });

  // --- proposal (the only model step) ------------------------------------
  const t3 = input.now();
  const proposalInput: ProposalInput = {
    householdName: input.householdName,
    drift,
    observations: observations.map((o) => ({
      kind: o.kind, severity: o.severity, assetClass: o.assetClass, detail: o.detail,
    })),
    ctx,
    symbolsById: input.symbolsById,
    pricesBySecurityId: input.pricesBySecurityId,
  };

  let candidates: Candidate[] = [];
  let tokensIn: number | null = null;
  let tokensOut: number | null = null;
  try {
    const result = await engine.propose(proposalInput);
    candidates = result.candidates;
    tokensIn = result.tokensIn ?? null;
    tokensOut = result.tokensOut ?? null;
    record({
      agent: 'proposal', stepType: 'reasoning',
      input: { worstDriftBps: drift.worstDriftBps, observations: observations.length },
      output: { candidates: candidates.length },
      model: engine.model, tokensIn, tokensOut, latencyMs: input.now() - t3,
    });
  } catch (error) {
    // A model failure is recorded and the run continues to completion with zero recommendations.
    // Failing the whole cycle would discard the observations, which are the part that did work.
    record({
      agent: 'proposal', stepType: 'rejection',
      input: { engine: engine.id },
      output: { error: error instanceof Error ? error.message : String(error) },
      model: engine.model, tokensIn: null, tokensOut: null, latencyMs: input.now() - t3,
    });
  }

  // --- guardrail ---------------------------------------------------------
  const accepted: GraphResult['accepted'] = [];
  for (const candidate of candidates) {
    const t = input.now();
    const guardrail = evaluateGuardrails(candidate.legs, { ...ctx, action: candidate.action });
    if (guardrail.pass) {
      accepted.push({ candidate, guardrail });
      record({
        agent: 'guardrail', stepType: 'decision',
        input: { action: candidate.action, legs: candidate.legs.length },
        output: { pass: true, rulesEvaluated: guardrail.rulesEvaluated.length },
        model: null, tokensIn: null, tokensOut: null, latencyMs: input.now() - t,
      });
    } else {
      // The rejection is the audit. This candidate never reaches the advisor, and the trace is
      // the only place it exists — see contract §2, agent_steps.step_type.
      record({
        agent: 'guardrail', stepType: 'rejection',
        input: { action: candidate.action, legs: candidate.legs, rationale: candidate.rationale },
        output: { pass: false, breaches: guardrail.breaches },
        model: null, tokensIn: null, tokensOut: null, latencyMs: input.now() - t,
      });
    }
  }

  return { drift, observations, accepted, steps };
}
