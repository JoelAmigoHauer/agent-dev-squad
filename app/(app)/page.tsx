import Link from 'next/link';
import { getServerClient } from '@/lib/db/server';
import { getAdvisorSession } from '@/lib/db/session';
import { PageHeader } from '@/components/ui/shell';
import { Card, CardHeader, EmptyState, StatusPill, SeverityDot } from '@/components/ui/primitives';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await getAdvisorSession();
  const supabase = await getServerClient();

  const [{ data: households }, { data: openRecs }, { data: runs }] = await Promise.all([
    supabase.from('households').select('id, name'),
    supabase.from('recommendations')
      .select('id, household_id, action, rank, status, rationale, created_at')
      .eq('status', 'pending').order('created_at', { ascending: false }).limit(10),
    supabase.from('agent_runs')
      .select('id, household_id, status, trigger, started_at, finished_at')
      .order('started_at', { ascending: false }).limit(10),
  ]);

  const { data: breaches } = await supabase
    .from('observations').select('household_id, severity, kind')
    .eq('severity', 'critical').order('detected_at', { ascending: false }).limit(50);

  const householdName = new Map((households ?? []).map((h) => [h.id, h.name]));
  const breachedHouseholds = new Set((breaches ?? []).map((b) => b.household_id));

  const stats = [
    { label: 'Households', value: households?.length ?? 0 },
    { label: 'Open recommendations', value: openRecs?.length ?? 0 },
    { label: 'Breaching mandate', value: breachedHouseholds.size },
    { label: 'Last cycle', value: runs?.[0]?.started_at
        ? new Date(runs[0].started_at).toLocaleString() : '—' },
  ];

  return (
    <>
      <PageHeader title="Dashboard" subtitle={session?.firm.name} />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="px-5 py-4">
            <p className="text-xs uppercase tracking-wide text-text-subtle">{stat.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular">{stat.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Open recommendations" />
          {(openRecs ?? []).length === 0 ? (
            <EmptyState
              title="Nothing awaiting review"
              body="Every household with a published mandate is inside its bands, or no cycle has run yet."
            />
          ) : (
            <ul className="divide-y divide-border">
              {(openRecs ?? []).map((rec) => (
                <li key={rec.id} className="px-5 py-3">
                  <Link href={`/recommendations/${rec.id}`} className="block hover:opacity-80">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{householdName.get(rec.household_id) ?? 'Household'}</span>
                      <StatusPill status={rec.status} />
                    </div>
                    <p className="mt-1 line-clamp-2 text-text-muted">{rec.rationale}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Recent agent activity" />
          {(runs ?? []).length === 0 ? (
            <EmptyState title="No cycles yet"
                        body="Run a monitoring cycle from a household to see agent activity here." />
          ) : (
            <ul className="divide-y divide-border">
              {(runs ?? []).map((run) => (
                <li key={run.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <Link href={`/runs/${run.id}`} className="flex items-center gap-2 hover:opacity-80">
                    <SeverityDot severity={run.status === 'failed' ? 'critical' : 'info'} />
                    <span>{householdName.get(run.household_id) ?? 'Household'}</span>
                    <span className="text-text-subtle">· {run.trigger}</span>
                  </Link>
                  <div className="flex items-center gap-3">
                    <span className="tabular text-xs text-text-subtle">
                      {new Date(run.started_at).toLocaleString()}
                    </span>
                    <StatusPill status={run.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
