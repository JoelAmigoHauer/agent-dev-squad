import { z } from 'zod';
import { getServerClient, getServiceClient } from '@/lib/db/server';
import { requireWriter, isUuid } from '@/lib/api/guards';
import { loadDecidable } from '@/lib/api/decide';
import { loadHouseholdFacts } from '@/lib/api/household-facts';
import { evaluateGuardrails } from '@/lib/guardrails/engine';
import { multiplyQuantityByPrice, toDb } from '@/lib/domain/money';
import { appendLedger } from '@/lib/ledger';
import { conflict, internal, notFound, ok, unprocessable } from '@/lib/api/respond';
import type { ProposedLeg } from '@/lib/guardrails/types';

const bodySchema = z.object({
  legs: z.array(z.object({
    accountId: z.string().uuid(),
    securityId: z.string().uuid(),
    side: z.enum(['buy', 'sell']),
    quantity: z.number().positive(),
  })).min(1),
  note: z.string().max(4000).optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireWriter();
  if ('response' in guard) return guard.response;
  const { id } = await params;
  if (!isUuid(id)) return notFound();
  const { session } = guard;

  try {
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return unprocessable('validation', issue?.path.join('.'), issue?.message);
    }

    const loaded = await loadDecidable(id, session, { requireFresh: true });
    if ('response' in loaded) return loaded.response;
    const recommendation = loaded.recommendation;

    const supabase = await getServerClient();
    const facts = await loadHouseholdFacts(supabase, recommendation.household_id);
    if (!facts) return notFound('household_not_found');

    const legs: ProposedLeg[] = [];
    for (const leg of parsed.data.legs) {
      const price = facts.pricesBySecurityId.get(leg.securityId);
      if (!price) return unprocessable('unknown_security', 'legs', { securityId: leg.securityId });
      if (!facts.ctx.accounts.some((a) => a.id === leg.accountId)) {
        return unprocessable('unknown_account', 'legs', { accountId: leg.accountId });
      }
      legs.push({ ...leg, estPrice: price, estAmount: multiplyQuantityByPrice(leg.quantity, price) });
    }

    // The same engine, the same code path the agent's own proposal went through. An advisor's
    // modification is not privileged over the mandate — contract §3.
    const guardrail = evaluateGuardrails(legs, {
      ...facts.ctx, action: recommendation.action,
    });
    if (!guardrail.pass) {
      return unprocessable('guardrail_breach', undefined, { breaches: guardrail.breaches });
    }

    const service = getServiceClient();
    // Supersede rather than delete: a modified_approved recommendation must be able to show both
    // what was proposed and what was actually approved.
    await service.from('recommendation_legs')
      .update({ superseded: true }).eq('recommendation_id', id).eq('superseded', false);
    await service.from('recommendation_legs').insert(legs.map((leg, index) => ({
      recommendation_id: id, seq: index + 1,
      account_id: leg.accountId, security_id: leg.securityId, side: leg.side,
      quantity: leg.quantity, est_price: leg.estPrice, est_amount: toDb(leg.estAmount),
    })));

    const { data: updated, error } = await supabase
      .from('recommendations')
      .update({
        status: 'modified_approved', decided_at: new Date().toISOString(),
        decided_by: session.userId, decision_note: parsed.data.note ?? null,
      })
      .eq('id', id).eq('status', 'pending')
      .select('id').maybeSingle();
    if (error) return internal(error);
    if (!updated) return conflict('already_decided');

    const { seq } = await appendLedger({
      firmId: session.profile.firm_id,
      actor: { type: 'advisor', advisorId: session.userId },
      eventType: 'recommendation.modified_approved',
      householdId: recommendation.household_id,
      subjectType: 'recommendation', subjectId: id,
      payload: {
        action: recommendation.action,
        originalRationale: recommendation.rationale,
        modifiedLegs: legs.map((l) => ({
          accountId: l.accountId, securityId: l.securityId,
          side: l.side, quantity: l.quantity, estAmount: toDb(l.estAmount),
        })),
        guardrail: JSON.parse(JSON.stringify(guardrail)),
        note: parsed.data.note ?? null,
      },
      dataSources: [recommendation.provenance],
    });

    return ok({ status: 'modified_approved', ledgerSeq: seq, guardrail });
  } catch (error) {
    return internal(error);
  }
}
