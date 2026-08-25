import { z } from 'zod';
import { getServerClient } from '@/lib/db/server';
import { requireWriter, isUuid } from '@/lib/api/guards';
import { loadDecidable } from '@/lib/api/decide';
import { appendLedger } from '@/lib/ledger';
import { conflict, internal, notFound, ok, unprocessable } from '@/lib/api/respond';

const bodySchema = z.object({ reason: z.string().min(1).max(4000) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireWriter();
  if ('response' in guard) return guard.response;
  const { id } = await params;
  if (!isUuid(id)) return notFound();
  const { session } = guard;

  try {
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    // A rejection without a reason is not an audit trail — the examiner's question is always why.
    if (!parsed.success) return unprocessable('reason_required', 'reason');

    const loaded = await loadDecidable(id, session);
    if ('response' in loaded) return loaded.response;

    const supabase = await getServerClient();
    const { data: updated, error } = await supabase
      .from('recommendations')
      .update({
        status: 'rejected', decided_at: new Date().toISOString(),
        decided_by: session.userId, decision_note: parsed.data.reason,
      })
      .eq('id', id).eq('status', 'pending')
      .select('id').maybeSingle();

    if (error) return internal(error);
    if (!updated) return conflict('already_decided');

    const { seq } = await appendLedger({
      firmId: session.profile.firm_id,
      actor: { type: 'advisor', advisorId: session.userId },
      eventType: 'recommendation.rejected',
      householdId: loaded.recommendation.household_id,
      subjectType: 'recommendation', subjectId: id,
      payload: {
        action: loaded.recommendation.action,
        rank: loaded.recommendation.rank,
        reason: parsed.data.reason,
      },
      dataSources: [loaded.recommendation.provenance],
    });

    return ok({ status: 'rejected', ledgerSeq: seq });
  } catch (error) {
    return internal(error);
  }
}
