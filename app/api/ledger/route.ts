import { getServerClient } from '@/lib/db/server';
import { requireSession } from '@/lib/api/guards';
import { internal, ok } from '@/lib/api/respond';

const PAGE = 100;

export async function GET(req: Request) {
  const guard = await requireSession();
  if ('response' in guard) return guard.response;

  try {
    const url = new URL(req.url);
    const supabase = await getServerClient();

    let query = supabase.from('decision_ledger').select('*').order('seq', { ascending: false });
    const householdId = url.searchParams.get('householdId');
    const actorType = url.searchParams.get('actorType');
    const eventType = url.searchParams.get('eventType');
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const cursor = url.searchParams.get('cursor');

    if (householdId) query = query.eq('household_id', householdId);
    if (actorType) query = query.eq('actor_type', actorType);
    if (eventType) query = query.eq('event_type', eventType);
    if (from) query = query.gte('occurred_at', from);
    if (to) query = query.lte('occurred_at', to);
    // Keyset on seq, not offset: the ledger only ever grows, so an offset page would shift.
    if (cursor) query = query.lt('seq', Number(cursor));

    const { data, error } = await query.limit(PAGE + 1);
    if (error) return internal(error);

    const rows = data ?? [];
    const hasMore = rows.length > PAGE;
    const entries = hasMore ? rows.slice(0, PAGE) : rows;

    return ok({
      entries,
      nextCursor: hasMore ? String(entries[entries.length - 1]?.seq ?? '') : null,
    });
  } catch (error) {
    return internal(error);
  }
}
