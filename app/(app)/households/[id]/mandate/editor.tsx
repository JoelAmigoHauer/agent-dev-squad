'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, formatBps } from '@/components/ui/primitives';

const ASSET_CLASSES = [
  'us_equity', 'intl_developed_equity', 'emerging_equity',
  'us_bond', 'intl_bond', 'real_assets', 'cash',
] as const;

const ACTIONS = [
  'rebalance_trade', 'tax_loss_harvest', 'cash_raise', 'cash_invest', 'alert_only',
] as const;

const STEPS = [
  'Objective & risk', 'Allocation bands', 'Tax', 'Liquidity', 'Rebalancing', 'Autonomy',
] as const;

interface Allocation { assetClass: string; targetBps: number; minBps: number; maxBps: number }
interface Autonomy {
  action: string; tier: string; maxTradeAmount: number | null; maxDailyAmount: number | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function MandateEditor({ householdId, draft, published }: { householdId: string; draft: any; published: any }) {
  const router = useRouter();
  const source = draft ?? published;

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<{ error: string; detail?: unknown } | null>(null);

  const [objective, setObjective] = useState<string>(source?.objective ?? '');
  const [riskTarget, setRiskTarget] = useState<number>(source?.risk_target ?? 5);
  const [taxSensitivity, setTaxSensitivity] = useState<string>(source?.tax_sensitivity ?? 'moderate');
  const [realizedGainBudget, setRealizedGainBudget] = useState<string>(
    source?.realized_gain_budget != null ? String(source.realized_gain_budget) : '');
  const [minCashBps, setMinCashBps] = useState<number>(source?.min_cash_bps ?? 200);
  const [liquidityNeed, setLiquidityNeed] = useState<string>(String(source?.liquidity_need ?? 0));
  const [driftToleranceBps, setDriftToleranceBps] = useState<number>(source?.drift_tolerance_bps ?? 500);
  const [minTradeAmount, setMinTradeAmount] = useState<string>(String(source?.min_trade_amount ?? 1000));
  const [rebalanceTrigger, setRebalanceTrigger] = useState<string>(source?.rebalance_trigger ?? 'band');

  const [allocations, setAllocations] = useState<Allocation[]>(
    (source?.mandate_allocations ?? []).length
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? (source.mandate_allocations as any[]).map((a) => ({
          assetClass: a.asset_class, targetBps: a.target_bps, minBps: a.min_bps, maxBps: a.max_bps,
        }))
      : [
          { assetClass: 'us_equity', targetBps: 4500, minBps: 4000, maxBps: 5000 },
          { assetClass: 'intl_developed_equity', targetBps: 1500, minBps: 1200, maxBps: 1800 },
          { assetClass: 'emerging_equity', targetBps: 500, minBps: 300, maxBps: 700 },
          { assetClass: 'us_bond', targetBps: 2500, minBps: 2000, maxBps: 3000 },
          { assetClass: 'intl_bond', targetBps: 500, minBps: 300, maxBps: 700 },
          { assetClass: 'real_assets', targetBps: 500, minBps: 300, maxBps: 700 },
        ],
  );

  const [autonomy, setAutonomy] = useState<Autonomy[]>(
    (source?.mandate_autonomy ?? []).length
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? (source.mandate_autonomy as any[]).map((a) => ({
          action: a.action, tier: a.tier,
          maxTradeAmount: a.max_trade_amount, maxDailyAmount: a.max_daily_amount,
        }))
      : ACTIONS.map((action) => ({
          action, tier: 'propose', maxTradeAmount: null, maxDailyAmount: null,
        })),
  );

  const sumBps = allocations.reduce((sum, a) => sum + a.targetBps, 0);
  const sumValid = sumBps === 10_000;
  // Every auto_execute tier must carry both bounds. The database refuses an unbounded one
  // outright; the UI should not let the advisor reach that refusal. design.md S5.
  const autonomyValid = autonomy.every(
    (a) => a.tier !== 'auto_execute' || (!!a.maxTradeAmount && !!a.maxDailyAmount));
  const canPublish = sumValid && autonomyValid && allocations.length > 0;

  async function saveDraft() {
    setSaving(true);
    setError(null);
    const response = await fetch(`/api/households/${householdId}/mandate/draft`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        objective, riskTarget, taxSensitivity,
        realizedGainBudget: realizedGainBudget === '' ? null : Number(realizedGainBudget),
        minCashBps, liquidityNeed: Number(liquidityNeed) || 0,
        driftToleranceBps, minTradeAmount: Number(minTradeAmount) || 0,
        rebalanceTrigger, allocations, autonomy,
      }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? `save failed (${response.status})`);
    }
    setSaving(false);
  }

  async function publish() {
    setSaving(true);
    setPublishError(null);
    await saveDraft();
    const response = await fetch(`/api/households/${householdId}/mandate/publish`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
    });
    if (!response.ok) {
      setPublishError(await response.json().catch(() => ({ error: 'publish_failed' })));
      setSaving(false);
      return;
    }
    router.push(`/households/${householdId}`);
    router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-4">
      <nav className="lg:col-span-1">
        <ol className="space-y-1">
          {STEPS.map((label, index) => (
            <li key={label}>
              <button
                onClick={() => setStep(index)}
                className={`w-full rounded-md px-3 py-2 text-left ${
                  index === step ? 'bg-accent-subtle font-medium text-accent'
                                 : 'text-text-muted hover:bg-surface-sunken'}`}>
                <span className="tabular text-xs">{index + 1}.</span> {label}
              </button>
            </li>
          ))}
        </ol>
        {draft && (
          <p className="mt-4 rounded-md bg-info-subtle px-3 py-2 text-xs text-info">
            Resuming your draft (v{draft.version}). Nothing here is enforced until you publish.
          </p>
        )}
      </nav>

      <div className="space-y-4 lg:col-span-3">
        <Card>
          <CardHeader title={STEPS[step]!} />
          <div className="space-y-4 px-5 py-4">
            {step === 0 && (
              <>
                <Field label="Objective">
                  <textarea value={objective} onChange={(e) => setObjective(e.target.value)} rows={3}
                            placeholder="e.g. Fund retirement from 2031 while limiting drawdown."
                            className="w-full rounded-md border border-border bg-bg px-3 py-2" />
                </Field>
                <Field label={`Risk target: ${riskTarget} of 10`}>
                  <input type="range" min={1} max={10} value={riskTarget}
                         onChange={(e) => setRiskTarget(Number(e.target.value))} className="w-full" />
                </Field>
              </>
            )}

            {step === 1 && (
              <>
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-text-subtle">
                      <th className="py-2 font-medium">Asset class</th>
                      <th className="py-2 font-medium">Target</th>
                      <th className="py-2 font-medium">Min</th>
                      <th className="py-2 font-medium">Max</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {allocations.map((allocation, index) => (
                      <tr key={index}>
                        <td className="py-1 pr-2">
                          <select value={allocation.assetClass}
                                  onChange={(e) => patchAllocation(index, { assetClass: e.target.value })}
                                  className="w-full rounded-md border border-border bg-bg px-2 py-1">
                            {ASSET_CLASSES.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
                          </select>
                        </td>
                        <BpsInput value={allocation.targetBps} onChange={(v) => patchAllocation(index, { targetBps: v })} />
                        <BpsInput value={allocation.minBps} onChange={(v) => patchAllocation(index, { minBps: v })} />
                        <BpsInput value={allocation.maxBps} onChange={(v) => patchAllocation(index, { maxBps: v })} />
                        <td className="py-1 pl-2">
                          <button onClick={() => setAllocations(allocations.filter((_, i) => i !== index))}
                                  className="text-text-subtle hover:text-negative">remove</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setAllocations([...allocations,
                      { assetClass: 'other', targetBps: 0, minBps: 0, maxBps: 0 }])}
                    className="rounded-md border border-border px-3 py-1.5">Add class</button>
                  {/* The server refuses a sum that is not exactly 10000bps anyway. Showing the
                      running total while editing is the difference between a 10-minute config
                      and a frustrating one. design.md S5. */}
                  <p className={sumValid ? 'text-positive' : 'font-medium text-negative'}>
                    Targets total {formatBps(sumBps)}
                    {!sumValid && ` — must be exactly 100.00%`}
                  </p>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <Field label="Tax sensitivity">
                  <select value={taxSensitivity} onChange={(e) => setTaxSensitivity(e.target.value)}
                          className="w-full rounded-md border border-border bg-bg px-3 py-2">
                    <option value="none">None</option>
                    <option value="moderate">Moderate</option>
                    <option value="high">High</option>
                  </select>
                </Field>
                <Field label="Annual realised gain budget (USD, blank for none)">
                  <input type="number" value={realizedGainBudget} min={0}
                         onChange={(e) => setRealizedGainBudget(e.target.value)}
                         className="w-full rounded-md border border-border bg-bg px-3 py-2 tabular" />
                </Field>
              </>
            )}

            {step === 3 && (
              <>
                <Field label={`Minimum cash: ${formatBps(minCashBps)}`}>
                  <input type="range" min={0} max={2000} step={50} value={minCashBps}
                         onChange={(e) => setMinCashBps(Number(e.target.value))} className="w-full" />
                </Field>
                <Field label="Known liquidity need (USD)">
                  <input type="number" value={liquidityNeed} min={0}
                         onChange={(e) => setLiquidityNeed(e.target.value)}
                         className="w-full rounded-md border border-border bg-bg px-3 py-2 tabular" />
                </Field>
              </>
            )}

            {step === 4 && (
              <>
                <Field label="Rebalance trigger">
                  <select value={rebalanceTrigger} onChange={(e) => setRebalanceTrigger(e.target.value)}
                          className="w-full rounded-md border border-border bg-bg px-3 py-2">
                    <option value="band">When a band is breached</option>
                    <option value="calendar">On a calendar schedule</option>
                    <option value="both">Both</option>
                  </select>
                </Field>
                <Field label={`Drift tolerance: ${formatBps(driftToleranceBps)}`}>
                  <input type="range" min={50} max={2000} step={50} value={driftToleranceBps}
                         onChange={(e) => setDriftToleranceBps(Number(e.target.value))} className="w-full" />
                </Field>
                <Field label="Minimum trade amount (USD)">
                  <input type="number" value={minTradeAmount} min={0}
                         onChange={(e) => setMinTradeAmount(e.target.value)}
                         className="w-full rounded-md border border-border bg-bg px-3 py-2 tabular" />
                </Field>
              </>
            )}

            {step === 5 && (
              <div className="space-y-3">
                <p className="text-text-muted">
                  Autonomy is per action. <strong>Propose</strong> means Thelma prepares the trade
                  and you decide. <strong>Auto-execute</strong> requires both bounds and is refused
                  by the database without them.
                </p>
                {autonomy.map((entry, index) => (
                  <div key={entry.action} className="rounded-md border border-border p-3">
                    <div className="flex items-center gap-3">
                      <span className="flex-1 font-medium">{entry.action.replace(/_/g, ' ')}</span>
                      <select value={entry.tier}
                              onChange={(e) => patchAutonomy(index, { tier: e.target.value })}
                              className="rounded-md border border-border bg-bg px-2 py-1">
                        <option value="observe">Observe</option>
                        <option value="propose">Propose</option>
                        <option value="auto_execute">Auto-execute</option>
                      </select>
                    </div>
                    {entry.tier === 'auto_execute' && (
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <Field label="Max per trade (USD)">
                          <input type="number" min={1} value={entry.maxTradeAmount ?? ''}
                                 onChange={(e) => patchAutonomy(index, {
                                   maxTradeAmount: e.target.value === '' ? null : Number(e.target.value) })}
                                 className="w-full rounded-md border border-border bg-bg px-3 py-1.5 tabular" />
                        </Field>
                        <Field label="Max per day (USD)">
                          <input type="number" min={1} value={entry.maxDailyAmount ?? ''}
                                 onChange={(e) => patchAutonomy(index, {
                                   maxDailyAmount: e.target.value === '' ? null : Number(e.target.value) })}
                                 className="w-full rounded-md border border-border bg-bg px-3 py-1.5 tabular" />
                        </Field>
                      </div>
                    )}
                  </div>
                ))}
                {!autonomyValid && (
                  <p className="rounded-md bg-negative-subtle px-3 py-2 text-negative">
                    An auto-execute action needs both a per-trade and a per-day bound.
                  </p>
                )}
              </div>
            )}
          </div>
        </Card>

        {error && (
          <p role="alert" className="rounded-md bg-negative-subtle px-4 py-2 text-negative">
            {error.replace(/_/g, ' ')}
          </p>
        )}
        {publishError && (
          <div role="alert" className="rounded-md border border-negative bg-negative-subtle px-4 py-3 text-negative">
            <p className="font-semibold">Publish refused: {publishError.error.replace(/_/g, ' ')}</p>
            {publishError.detail !== undefined && (
              <pre className="mt-1 overflow-x-auto text-xs">{JSON.stringify(publishError.detail, null, 2)}</pre>
            )}
          </div>
        )}

        <div className="flex items-center gap-2">
          <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}
                  className="rounded-md border border-border px-4 py-2 disabled:opacity-40">Back</button>
          <button onClick={saveDraft} disabled={saving}
                  className="rounded-md border border-border px-4 py-2 disabled:opacity-60">
            {saving ? 'Saving…' : 'Save draft'}
          </button>
          <div className="flex-1" />
          {step < STEPS.length - 1 ? (
            <button onClick={async () => { await saveDraft(); setStep(step + 1); }}
                    className="rounded-md bg-accent px-4 py-2 font-medium text-white">Next</button>
          ) : (
            <button onClick={publish} disabled={!canPublish || saving}
                    className="rounded-md bg-accent px-4 py-2 font-medium text-white disabled:opacity-40">
              Publish mandate
            </button>
          )}
        </div>
      </div>
    </div>
  );

  function patchAllocation(index: number, patch: Partial<Allocation>) {
    setAllocations(allocations.map((a, i) => (i === index ? { ...a, ...patch } : a)));
  }
  function patchAutonomy(index: number, patch: Partial<Autonomy>) {
    setAutonomy(autonomy.map((a, i) => (i === index ? { ...a, ...patch } : a)));
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-text-muted">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

/** Advisors think in percent; the contract stores basis points as integers. Converting at the
 *  input boundary keeps the whole system on integer bps and off floating-point percentages. */
function BpsInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <td className="py-1 pr-2">
      <div className="flex items-center gap-1">
        <input type="number" step={0.01} min={0} max={100} value={(value / 100).toFixed(2)}
               onChange={(e) => onChange(Math.round(Number(e.target.value) * 100))}
               className="w-24 rounded-md border border-border bg-bg px-2 py-1 text-right tabular" />
        <span className="text-text-subtle">%</span>
      </div>
    </td>
  );
}
