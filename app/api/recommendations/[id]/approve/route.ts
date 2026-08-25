import { z } from 'zod';
import { getServerClient } from '@/lib/db/server';
import { requireWriter } from '@/lib/api/guards';
import { loadDecidable } from '@/lib/api/decide';
import { appendLedger } from '@/lib/ledger';
import { conflict, internal, ok } from '@/lib/api/respond';

const bodySchema = z.object({ note: z.string().max(4000).optional() });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireWriter();
  if ('response' in guard) return guard.response;
  const { id } = await params;
  const { session } = guard;

  try {
    const body = bodySchema.safeParse(await req.json().catch(() => ({})));
    const note = body.success ? body.data.note ?? null : null;

    const loaded = await loadDecidable(id, session, { requireFresh: true });
    if ('response' in loaded) return loaded.response;

    const supabase = await getServerClient();
    // Conditional on status='pending' so two advisors racing produce one winner and one 409,
    // rather than a last-write-wins overwrite of the first decision.
    const { data: updated, error } = await supabase
      .from('recommendations')
      .update({
        status: 'approved', decided_at: new Date().toISOString(),
        decided_by: session.userId, decision_note: note,
      })
      .eq('id', id).eq('status', 'pending')
      .select('id, status').maybeSingle();

    if (error) return internal(error);
    if (!updated) return conflict('already_decided');

    const { seq } = await appendLedger({
      firmId: session.profile.firm_id,
      actor: { type: 'advisor', advisorId: session.userId },
      eventType: 'recommendation.approved',
      householdId: loaded.recommendation.household_id,
      subjectType: 'recommendation', subjectId: id,
      payload: {
        action: loaded.recommendation.action,
        rank: loaded.recommendation.rank,
        rationale: loaded.recommendation.rationale,
        guardrail: loaded.recommendation.guardrail_result,
        note,
      },
      dataSources: [loaded.recommendation.provenance],
    });

    return ok({ status: 'approved', ledgerSeq: seq });
  } catch (error) {
    return internal(error);
  }
}
