import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getServerClient } from '@/lib/db/server';
import { loadHouseholdFacts } from '@/lib/api/household-facts';
import { computeDrift } from '@/lib/domain/drift';
import { ZERO, add, toDb } from '@/lib/domain/money';
import { PageHeader } from '@/components/ui/shell';
import {
  BpsCell, Card, CardHeader, DriftBar, EmptyState, MoneyCell, StatusPill,
} from '@/components/ui/primitives';
import { RunCycleButton } from './run-button';

export const dynamic = 'force-dynamic';

export default async function HouseholdPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getServerClient();
  const facts = await loadHouseholdFacts(supabase, id);
  if (!facts) notFound();

  // The blocking empty state: with no mandate there is nothing to measure against, so
  // "configure a mandate" is the only action offered. design.md S4.
  if (!facts.mandate) {
    return (
      <>
        <PageHeader title={facts.household.name} />
        <Card>
          <EmptyState
            title="No published mandate"
            body="Thelma cannot monitor this household until an advisor publishes a mandate. Nothing is measured, and no cycle will run."
            action={
              <Link href={`/households/${id}/mandate`}
                    className="mt-2 rounded-md bg-accent px-4 py-2 font-medium text-white">
                Configure mandate
              </Link>
            }
          />
        </Card>
      </>
    );
  }

  const drift = computeDrift(
    facts.ctx.positions.map((p) => ({
      assetClass: facts.ctx.securities.find((s) => s.id === p.securityId)?.assetClass ?? 'other',
      marketValue: p.marketValue,
    })),
    facts.ctx.mandate.bands,
    add(...facts.ctx.accounts.map((a) => a.cashBalance), ZERO),
  );

  const [{ data: openRecs }, { data: runs }, { data: accounts }] = await Promise.all([
    supabase.from('recommendations')
      .select('id, action, rank, status, rationale, stale_data')
      .eq('household_id', id).eq('status', 'pending').order('rank'),
    supabase.from('agent_runs')
      .select('id, status, trigger, started_at, finished_at')
      .eq('household_id', id).order('started_at', { ascending: false }).limit(8),
    supabase.from('accounts').select('*').eq('household_id', id),
  ]);

  return (
    <>
      <PageHeader
        title={facts.household.name}
        subtitle={
          <span className="flex items-center gap-3">
            <MoneyCell value={toDb(drift.totalMarketValue)} />
            <StatusPill status="published" />
            <span className="tabular text-text-subtle">mandate v{facts.mandate.version}</span>
            {facts.asOf && (
              <span className="text-text-subtle">holdings as at {new Date(facts.asOf).toLocaleString()}</span>
            )}
          </span>
        }
        action={<RunCycleButton householdId={id} />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Allocation against mandate" />
          <div className="divide-y divide-border">
            {drift.bands.map((band) => (
              <div key={band.assetClass} className="grid grid-cols-12 items-center gap-3 px-5 py-3">
                <span className="col-span-3">{band.assetClass.replace(/_/g, ' ')}</span>
                <div className="col-span-4"><DriftBar {...band} /></div>
                <span className="col-span-2 text-right"><BpsCell bps={band.actualBps} /></span>
                <span className="col-span-1 text-right text-text-subtle">
                  <BpsCell bps={band.targetBps} />
                </span>
                <span className="col-span-2 text-right">
                  <BpsCell bps={band.driftBps} signed />
                  {band.breached && <span className="ml-2 text-xs font-medium text-negative">outside band</span>}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Open recommendations" />
          {(openRecs ?? []).length === 0 ? (
            // A household inside its mandate producing zero recommendations is the product
            // working. Worded as a success, never as an error. design.md §6.
            <EmptyState title="Within mandate"
                        body="No action is warranted from the most recent cycle." />
          ) : (
            <ul className="divide-y divide-border">
              {(openRecs ?? []).map((rec) => (
                <li key={rec.id} className="px-5 py-3">
                  <Link href={`/recommendations/${rec.id}`} className="block hover:opacity-80">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">#{rec.rank} {rec.action.replace(/_/g, ' ')}</span>
                      {rec.stale_data && <StatusPill status="warning" />}
                    </div>
                    <p className="mt-1 line-clamp-3 text-text-muted">{rec.rationale}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Holdings" />
          {(accounts ?? []).length === 0 ? (
            <EmptyState title="No holdings imported"
                        body="Import a custodian extract or sync an aggregator from Settings." />
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-subtle">
                  <th className="px-5 py-2 font-medium">Account</th>
                  <th className="px-5 py-2 font-medium">Security</th>
                  <th className="px-5 py-2 text-right font-medium">Quantity</th>
                  <th className="px-5 py-2 text-right font-medium">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {facts.ctx.positions.map((position, index) => {
                  const account = (accounts ?? []).find((a) => a.id === position.accountId);
                  return (
                    <tr key={`${position.accountId}-${position.securityId}-${index}`}>
                      <td className="px-5 py-2">
                        {account?.display_name}
                        <span className="ml-2 text-xs text-text-subtle">
                          {account?.tax_treatment.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-5 py-2 font-mono">
                        {facts.symbolsById.get(position.securityId)}
                      </td>
                      <td className="px-5 py-2 text-right tabular">{position.quantity}</td>
                      <td className="px-5 py-2 text-right">
                        <MoneyCell value={toDb(position.marketValue)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Run history"
            action={<Link href={`/households/${id}/mandate/versions`}
                          className="text-xs text-accent">Mandate versions</Link>}
          />
          {(runs ?? []).length === 0 ? (
            <EmptyState title="No cycles yet" body="Run a monitoring cycle to populate this." />
          ) : (
            <ul className="divide-y divide-border">
              {(runs ?? []).map((run) => (
                <li key={run.id} className="flex items-center justify-between px-5 py-2">
                  <Link href={`/runs/${run.id}`} className="tabular text-text-muted hover:text-accent">
                    {new Date(run.started_at).toLocaleString()}
                  </Link>
                  <StatusPill status={run.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
