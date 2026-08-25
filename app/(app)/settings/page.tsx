import { getServerClient } from '@/lib/db/server';
import { getAdvisorSession } from '@/lib/db/session';
import { PageHeader } from '@/components/ui/shell';
import { Card, CardHeader, EmptyState, StatusPill } from '@/components/ui/primitives';
import { ShadowModeToggle, SyncPanel } from './controls';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const session = await getAdvisorSession();
  const supabase = await getServerClient();

  const [{ data: connections }, { data: advisors }, { data: households }] = await Promise.all([
    supabase.from('aggregator_connections').select('*').order('vendor'),
    supabase.from('advisor_profiles').select('id, full_name, email, role').order('full_name'),
    supabase.from('households').select('id, name').order('name'),
  ]);

  const isPrincipal = session?.profile.role === 'principal';

  return (
    <>
      <PageHeader title="Settings" subtitle={session?.firm.name} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Custodian connections" />
          <div className="px-5 py-4">
            {(connections ?? []).length === 0 ? (
              <EmptyState
                title="No aggregator connected"
                body="v1.0 ingests through a data aggregator or a CSV extract. Use the simulated book below to exercise the pipeline before a vendor credential lands."
              />
            ) : (
              <ul className="mb-4 divide-y divide-border">
                {(connections ?? []).map((connection) => (
                  <li key={connection.id} className="flex items-center justify-between py-2">
                    <span className="font-medium">{connection.vendor}</span>
                    <div className="flex items-center gap-3">
                      {connection.last_sync_at && (
                        <span className="tabular text-xs text-text-subtle">
                          {new Date(connection.last_sync_at).toLocaleString()}
                        </span>
                      )}
                      <StatusPill status={connection.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {/* Vendor errors are shown verbatim: a paraphrased upstream error is a support
                ticket. design.md S10. */}
            {(connections ?? []).filter((c) => c.last_error).map((c) => (
              <p key={c.id} className="mb-3 rounded-md bg-negative-subtle px-3 py-2 text-xs text-negative">
                <strong>{c.vendor}:</strong> {c.last_error}
              </p>
            ))}
            <SyncPanel households={households ?? []} />
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Shadow mode" />
            <div className="px-5 py-4">
              <ShadowModeToggle
                enabled={session?.firm.shadow_mode ?? true}
                canToggle={isPrincipal}
              />
            </div>
          </Card>

          <Card>
            <CardHeader title="Advisors" />
            <ul className="divide-y divide-border">
              {(advisors ?? []).map((advisor) => (
                <li key={advisor.id} className="flex items-center justify-between px-5 py-2">
                  <div>
                    <p className="font-medium">{advisor.full_name}</p>
                    <p className="text-xs text-text-subtle">{advisor.email}</p>
                  </div>
                  <StatusPill status={advisor.role} />
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
