import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getServerClient } from '@/lib/db/server';
import { PageHeader } from '@/components/ui/shell';
import { Card, CardHeader, EmptyState, SeverityDot, StatusPill } from '@/components/ui/primitives';

export const dynamic = 'force-dynamic';

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getServerClient();

  const { data: run } = await supabase.from('agent_runs').select('*').eq('id', id).maybeSingle();
  if (!run) notFound();

  const [{ data: steps }, { data: observations }, { data: household }, { data: mandate }] =
    await Promise.all([
      supabase.from('agent_steps').select('*').eq('run_id', id).order('seq'),
      supabase.from('observations').select('*').eq('run_id', id).order('detected_at'),
      supabase.from('households').select('name').eq('id', run.household_id).maybeSingle(),
      supabase.from('mandates').select('version').eq('id', run.mandate_id).maybeSingle(),
    ]);

  const duration = run.finished_at
    ? `${((new Date(run.finished_at).getTime() - new Date(run.started_at).getTime()) / 1000).toFixed(1)}s`
    : 'running';

  return (
    <>
      <PageHeader
        title="Agent run trace"
        subtitle={
          <span className="flex items-center gap-3">
            <Link href={`/households/${run.household_id}`} className="hover:text-accent">
              {household?.name}
            </Link>
            <StatusPill status={run.status} />
            <span className="text-text-subtle">
              mandate v{mandate?.version} · {run.trigger} · {duration}
            </span>
          </span>
        }
      />

      {run.error && (
        <div className="mb-6 rounded-md border border-negative bg-negative-subtle px-4 py-3 text-negative">
          <p className="font-semibold">This run failed.</p>
          <p className="mt-1 font-mono text-xs">{run.error}</p>
          <p className="mt-1">Steps completed before the failure are shown below.</p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Steps" action={
            <span className="text-xs text-text-subtle">{steps?.length ?? 0} steps</span>
          } />
          {(steps ?? []).length === 0 ? (
            <EmptyState title="No steps recorded yet" body="This run may still be starting." />
          ) : (
            <ul className="divide-y divide-border">
              {(steps ?? []).map((step) => {
                // A guardrail rejection never reached the advisor. This trace is the only place
                // it exists, so it must not render as an ordinary step. design.md S9.
                const rejected = step.step_type === 'rejection';
                return (
                  <li key={step.id}
                      className={`px-5 py-3 ${rejected ? 'border-l-2 border-negative bg-negative-subtle' : ''}`}>
                    <div className="flex items-center gap-3">
                      <span className="w-6 tabular text-text-subtle">{step.seq}</span>
                      <span className="font-medium">{step.agent}</span>
                      <span className={`rounded px-1.5 py-0.5 text-xs ${
                        rejected ? 'bg-negative text-white' : 'bg-surface-sunken text-text-muted'}`}>
                        {step.step_type}
                      </span>
                      {step.model && (
                        <span className="font-mono text-xs text-text-subtle">{step.model}</span>
                      )}
                      <span className="ml-auto tabular text-xs text-text-subtle">
                        {step.latency_ms}ms
                        {step.tokens_in !== null && ` · ${step.tokens_in}/${step.tokens_out} tok`}
                      </span>
                    </div>
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-text-subtle">
                        {rejected ? 'why this was refused' : 'input and output'}
                      </summary>
                      <pre className="mt-2 overflow-x-auto rounded bg-surface-sunken p-3 text-xs">
{JSON.stringify({ input: step.input, output: step.output }, null, 2)}
                      </pre>
                    </details>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Observations" />
          {(observations ?? []).length === 0 ? (
            <EmptyState title="Nothing material"
                        body="No drift, breach or cash event exceeded the mandate's thresholds." />
          ) : (
            <ul className="divide-y divide-border">
              {(observations ?? []).map((observation) => (
                <li key={observation.id} className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <SeverityDot severity={observation.severity} />
                    <span className="font-medium">{observation.kind.replace(/_/g, ' ')}</span>
                    {observation.asset_class && (
                      <span className="text-text-subtle">{observation.asset_class.replace(/_/g, ' ')}</span>
                    )}
                  </div>
                  <pre className="mt-1 overflow-x-auto text-xs text-text-muted">
{JSON.stringify(observation.detail, null, 2)}
                  </pre>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
