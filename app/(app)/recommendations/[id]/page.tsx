import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getServerClient } from '@/lib/db/server';
import { PageHeader } from '@/components/ui/shell';
import { Card, CardHeader, MoneyCell, BpsCell, StatusPill } from '@/components/ui/primitives';
import { DecisionBar } from './decision-bar';

export const dynamic = 'force-dynamic';

interface GuardrailResult {
  pass: boolean;
  rulesEvaluated: { rule: number; name: string; pass: boolean; detail?: unknown }[];
  breaches: { rule: number; name: string; detail?: unknown }[];
}

export default async function RecommendationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getServerClient();

  const { data: rec } = await supabase.from('recommendations').select('*').eq('id', id).maybeSingle();
  if (!rec) notFound();

  const [{ data: legs }, { data: household }, { data: decidedBy }] = await Promise.all([
    supabase.from('recommendation_legs')
      .select('*, securities(symbol, name), accounts(display_name, tax_treatment)')
      .eq('recommendation_id', id).eq('superseded', false).order('seq'),
    supabase.from('households').select('id, name').eq('id', rec.household_id).maybeSingle(),
    rec.decided_by
      ? supabase.from('advisor_profiles').select('full_name').eq('id', rec.decided_by).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const guardrail = rec.guardrail_result as unknown as GuardrailResult;
  const provenance = rec.provenance as Record<string, unknown>;
  const expired = new Date(rec.expires_at).getTime() <= Date.now();

  return (
    <>
      <PageHeader
        title={`${rec.action.replace(/_/g, ' ')} · rank ${rec.rank}`}
        subtitle={
          <span className="flex items-center gap-3">
            <Link href={`/households/${rec.household_id}`} className="hover:text-accent">
              {household?.name}
            </Link>
            <StatusPill status={expired && rec.status === 'pending' ? 'expired' : rec.status} />
            {rec.stale_data && <StatusPill status="warning" />}
            <span className="text-text-subtle">
              {expired ? 'expired ' : 'expires '}
              {new Date(rec.expires_at).toLocaleString()}
            </span>
          </span>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Rationale" />
            {/* Given room, never truncated and never behind a "read more". This is the paragraph
                an examiner reads. design.md S7. */}
            <p className="whitespace-pre-wrap px-5 py-4 leading-relaxed">{rec.rationale}</p>
          </Card>

          <Card>
            <CardHeader title="Proposed trades" />
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-subtle">
                  <th className="px-5 py-2 font-medium">Account</th>
                  <th className="px-5 py-2 font-medium">Security</th>
                  <th className="px-5 py-2 font-medium">Side</th>
                  <th className="px-5 py-2 text-right font-medium">Quantity</th>
                  <th className="px-5 py-2 text-right font-medium">Est. price</th>
                  <th className="px-5 py-2 text-right font-medium">Est. amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(legs ?? []).map((leg) => (
                  <tr key={leg.id}>
                    <td className="px-5 py-2">
                      {leg.accounts?.display_name}
                      <span className="ml-2 text-xs text-text-subtle">
                        {leg.accounts?.tax_treatment?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-2 font-mono">{leg.securities?.symbol}</td>
                    <td className="px-5 py-2">
                      <span className={leg.side === 'sell' ? 'text-negative' : 'text-positive'}>
                        {leg.side}
                      </span>
                    </td>
                    <td className="px-5 py-2 text-right tabular">{leg.quantity}</td>
                    <td className="px-5 py-2 text-right"><MoneyCell value={leg.est_price} /></td>
                    <td className="px-5 py-2 text-right"><MoneyCell value={leg.est_amount} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card>
            <CardHeader title="Guardrail evaluation" action={
              <span className="text-xs text-text-subtle">
                {guardrail?.rulesEvaluated?.length ?? 0} rules evaluated
              </span>
            } />
            {/* Every rule, passes included. A passing recommendation shows eleven green rows —
                that is the point: "checked and fine" must be visually distinct from "never
                checked". contract §3, design.md S7. */}
            <ul className="divide-y divide-border">
              {(guardrail?.rulesEvaluated ?? []).map((rule) => (
                <li key={rule.rule} className="flex items-start gap-3 px-5 py-2">
                  <span className={`mt-1 inline-block h-2 w-2 shrink-0 rounded-full ${
                    rule.pass ? 'bg-positive' : 'bg-negative'}`} />
                  <span className="w-8 shrink-0 tabular text-text-subtle">{rule.rule}</span>
                  <span className={rule.pass ? '' : 'font-medium text-negative'}>{rule.name}</span>
                  {!rule.pass && rule.detail !== undefined && (
                    <code className="ml-auto max-w-[45%] truncate text-xs text-text-subtle">
                      {JSON.stringify(rule.detail)}
                    </code>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Projected impact" />
            <dl className="divide-y divide-border">
              <Row label="Worst drift before"><BpsCell bps={rec.projected_drift_bps_before} /></Row>
              <Row label="Worst drift after"><BpsCell bps={rec.projected_drift_bps_after} /></Row>
              <Row label="Realised gain"><MoneyCell value={rec.projected_realized_gain} /></Row>
              <Row label="Estimated tax cost"><MoneyCell value={rec.projected_tax_cost} /></Row>
            </dl>
          </Card>

          <Card>
            <CardHeader title="Provenance" />
            {/* Visible without interaction — these screens get printed for examinations. */}
            <dl className="divide-y divide-border">
              {Object.entries(provenance ?? {}).map(([key, value]) => (
                <Row key={key} label={key.replace(/([A-Z])/g, ' $1').toLowerCase()}>
                  {key === 'runId' && typeof value === 'string'
                    ? <Link href={`/runs/${value}`} className="text-accent">view trace</Link>
                    : <span className="tabular text-text-muted">{String(value ?? '—')}</span>}
                </Row>
              ))}
            </dl>
          </Card>

          {rec.status === 'pending' && !expired ? (
            <DecisionBar id={id} staleData={rec.stale_data} />
          ) : (
            <Card>
              <CardHeader title="Decision" />
              <dl className="divide-y divide-border">
                <Row label="Outcome"><StatusPill status={expired && rec.status === 'pending' ? 'expired' : rec.status} /></Row>
                {rec.decided_at && (
                  <Row label="Decided"><span className="tabular">{new Date(rec.decided_at).toLocaleString()}</span></Row>
                )}
                {decidedBy?.full_name && <Row label="By">{decidedBy.full_name}</Row>}
                {rec.decision_note && <Row label="Note">{rec.decision_note}</Row>}
                {expired && rec.status === 'pending' && (
                  <Row label="Why">
                    <span className="text-text-muted">
                      Expired before a decision. Run a fresh cycle rather than approving late.
                    </span>
                  </Row>
                )}
              </dl>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 py-2">
      <dt className="text-text-subtle">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}
