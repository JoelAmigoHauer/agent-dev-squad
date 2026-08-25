import { getServerClient } from '@/lib/db/server';
import { requireSession } from '@/lib/api/guards';
import { appendLedger } from '@/lib/ledger';
import { internal } from '@/lib/api/respond';

const COLUMNS = [
  'seq', 'occurred_at', 'actor_type', 'actor_id', 'agent_identity', 'event_type',
  'household_id', 'subject_type', 'subject_id', 'payload', 'data_sources', 'prev_hash', 'row_hash',
] as const;

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export async function GET(req: Request) {
  const guard = await requireSession();
  if ('response' in guard) return guard.response;
  const { session } = guard;

  try {
    const url = new URL(req.url);
    const supabase = await getServerClient();
    let query = supabase.from('decision_ledger').select('*').order('seq', { ascending: true });

    const householdId = url.searchParams.get('householdId');
    const actorType = url.searchParams.get('actorType');
    const eventType = url.searchParams.get('eventType');
    if (householdId) query = query.eq('household_id', householdId);
    if (actorType) query = query.eq('actor_type', actorType);
    if (eventType) query = query.eq('event_type', eventType);

    const { data, error } = await query;
    if (error) return internal(error);
    const rows = data ?? [];

    // Appended BEFORE streaming. An export that is not itself in the ledger leaves no record
    // that client data left the system — contract §3.
    await appendLedger({
      firmId: session.profile.firm_id,
      actor: { type: 'advisor', advisorId: session.userId },
      eventType: 'ledger.exported',
      subjectType: 'ledger_export', subjectId: null,
      payload: {
        rows: rows.length,
        filters: { householdId, actorType, eventType },
        exportedAt: new Date().toISOString(),
      },
    });

    const csv = [
      COLUMNS.join(','),
      ...rows.map((row) => COLUMNS.map((c) => csvCell(row[c])).join(',')),
    ].join('\n');

    return new Response(csv, {
      status: 200,
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="thelma-ledger-${Date.now()}.csv"`,
      },
    });
  } catch (error) {
    return internal(error);
  }
}
