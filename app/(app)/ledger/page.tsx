import { getServerClient } from '@/lib/db/server';
import { PageHeader } from '@/components/ui/shell';
import { Card, EmptyState } from '@/components/ui/primitives';
import { LedgerTools } from './tools';

export const dynamic = 'force-dynamic';

export default async function LedgerPage({
  searchParams,
}: { searchParams: Promise<Record<string, string | undefined>> }) {
  const filters = await searchParams;
  const supabase = await getServerClient();

  let query = supabase.from('decision_ledger').select('*').order('seq', { ascending: false }).limit(100);
  if (filters.householdId) query = query.eq('household_id', filters.householdId);
  if (filters.actorType) query = query.eq('actor_type', filters.actorType);
  if (filters.eventType) query = query.eq('event_type', filters.eventType);

  const [{ data: entries }, { data: households }] = await Promise.all([
    query,
    supabase.from('households').select('id, name'),
  ]);
  const householdName = new Map((households ?? []).map((h) => [h.id, h.name]));
  const filtered = Boolean(filters.householdId || filters.actorType || filters.eventType);

  return (
    <>
      <PageHeader
        title="Decision ledger"
        subtitle="Append-only and hash-chained. Every entry commits to the one before it."
        action={<LedgerTools />}
      />

      <Card>
        {(entries ?? []).length === 0 ? (
          filtered
            ? <EmptyState title="No entries match this filter"
                          body="Clear the filter to see the full ledger." />
            : <EmptyState title="The ledger is empty"
                          body="Entries appear as mandates are published, cycles run and decisions are made." />
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-subtle">
                <th className="px-4 py-3 font-medium">Seq</th>
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Actor</th>
                <th className="px-4 py-3 font-medium">Event</th>
                <th className="px-4 py-3 font-medium">Household</th>
                <th className="px-4 py-3 font-medium">Hash</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(entries ?? []).map((entry) => (
                <tr key={entry.id} className="align-top hover:bg-surface-sunken">
                  <td className="px-4 py-2 tabular text-text-subtle">{entry.seq}</td>
                  <td className="px-4 py-2 tabular whitespace-nowrap">
                    {new Date(entry.occurred_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-2">
                    {/* An agent and an advisor must never look alike in this column: who acted is
                        the first question anyone asks of an audit trail. */}
                    {entry.actor_type === 'agent' ? (
                      <span className="rounded bg-info-subtle px-1.5 py-0.5 font-mono text-xs text-info">
                        {entry.agent_identity}
                      </span>
                    ) : (
                      <span className="text-text-muted">{entry.actor_type}</span>
                    )}
                  </td>
                  <td className="px-4 py-2 font-medium">{entry.event_type}</td>
                  <td className="px-4 py-2 text-text-muted">
                    {entry.household_id ? householdName.get(entry.household_id) ?? '—' : '—'}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-text-subtle">
                    {entry.row_hash.slice(0, 12)}…
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
