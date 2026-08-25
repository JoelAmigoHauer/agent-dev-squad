import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getServerClient } from '@/lib/db/server';
import { PageHeader } from '@/components/ui/shell';
import { Card, EmptyState, StatusPill, formatBps } from '@/components/ui/primitives';

export const dynamic = 'force-dynamic';

const DIFF_FIELDS = [
  'risk_target', 'drift_tolerance_bps', 'min_cash_bps', 'tax_sensitivity', 'min_trade_amount',
] as const;

export default async function VersionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getServerClient();

  const { data: household } = await supabase
    .from('households').select('name').eq('id', id).maybeSingle();
  if (!household) notFound();

  const { data: versions } = await supabase
    .from('mandates').select('*, mandate_allocations(*)')
    .eq('household_id', id).neq('status', 'draft')
    .order('version', { ascending: false });

  const rows = versions ?? [];

  return (
    <>
      <PageHeader
        title="Mandate versions"
        subtitle={<Link href={`/households/${id}`} className="hover:text-accent">{household.name}</Link>}
      />

      <Card>
        {rows.length === 0 ? (
          <EmptyState title="No published versions"
                      body="A mandate appears here once it is published. Drafts are not versions." />
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((version, index) => {
              const previous = rows[index + 1];
              const changed = previous
                ? DIFF_FIELDS.filter((f) => version[f] !== previous[f])
                : null;
              return (
                <li key={version.id} className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <span className="text-md font-semibold tabular">v{version.version}</span>
                    <StatusPill status={version.status} />
                    <span className="text-text-subtle">
                      {version.published_at
                        ? new Date(version.published_at).toLocaleString() : 'not published'}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-text-muted">
                    <span>risk {version.risk_target}/10</span>
                    <span>drift tolerance {formatBps(version.drift_tolerance_bps)}</span>
                    <span>min cash {formatBps(version.min_cash_bps)}</span>
                    <span>tax {version.tax_sensitivity}</span>
                  </div>

                  {/* Null for the first version, which has nothing to differ from — said in
                      words rather than rendered as an empty diff. design.md S6. */}
                  {changed === null ? (
                    <p className="mt-2 text-xs text-text-subtle">
                      First published version — nothing to compare against.
                    </p>
                  ) : changed.length === 0 ? (
                    <p className="mt-2 text-xs text-text-subtle">
                      No change to the compared fields against v{previous?.version}.
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-0.5 text-xs">
                      {changed.map((field) => (
                        <li key={field}>
                          <span className="text-text-subtle">{field.replace(/_/g, ' ')}: </span>
                          <span className="text-text-muted line-through">{String(previous?.[field])}</span>
                          <span className="mx-1 text-text-subtle">→</span>
                          <span className="font-medium">{String(version[field])}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
