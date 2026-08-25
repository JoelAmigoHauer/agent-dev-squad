'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function ShadowModeToggle({ enabled, canToggle }: { enabled: boolean; canToggle: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setBusy(true); setError(null);
    const response = await fetch('/api/firm/settings', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ shadowMode: !enabled }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? `failed (${response.status})`);
      setBusy(false);
      return;
    }
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-medium">{enabled ? 'On' : 'Off'}</p>
          {/* Consequence text next to the control, not under it. */}
          <p className="mt-1 text-text-muted">
            {enabled
              ? 'Recommendations are generated and reviewable. No order can leave the system.'
              : 'Execution paths are unlocked. In v1.0 no adapter claims order-routing capability, so nothing can execute regardless.'}
          </p>
        </div>
        <button onClick={toggle} disabled={!canToggle || busy}
                title={canToggle ? undefined : 'Only a principal can change shadow mode'}
                className="shrink-0 rounded-md border border-border px-4 py-2 disabled:opacity-40">
          {busy ? '…' : enabled ? 'Turn off' : 'Turn on'}
        </button>
      </div>
      {/* Disabled with an explanation rather than hidden, so an advisor understands why they
          cannot. design.md S10. */}
      {!canToggle && (
        <p className="text-xs text-text-subtle">Only a principal can change this setting.</p>
      )}
      {error && <p role="alert" className="text-negative">{error.replace(/_/g, ' ')}</p>}
    </div>
  );
}

export function SyncPanel({ households }: { households: { id: string; name: string }[] }) {
  const router = useRouter();
  const [householdId, setHouseholdId] = useState(households[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function sync() {
    setBusy(true); setError(null); setMessage(null);
    const response = await fetch('/api/custodian/sync', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ householdId, vendor: 'simulated' }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError((body as { error?: string }).error ?? `failed (${response.status})`);
      setBusy(false);
      return;
    }
    const result = body as { accounts: number; positions: number; taxLots: number; transactions: number };
    setMessage(`${result.accounts} accounts, ${result.positions} positions, ` +
               `${result.taxLots} tax lots, ${result.transactions} transactions.`);
    setBusy(false);
    router.refresh();
  }

  if (households.length === 0) {
    return <p className="text-text-muted">Create a household before syncing.</p>;
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <select value={householdId} onChange={(e) => setHouseholdId(e.target.value)}
                className="flex-1 rounded-md border border-border bg-bg px-3 py-2">
          {households.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
        <button onClick={sync} disabled={busy || !householdId}
                className="rounded-md bg-accent px-4 py-2 font-medium text-white disabled:opacity-60">
          {busy ? 'Syncing…' : 'Sync simulated book'}
        </button>
      </div>
      {message && <p className="rounded-md bg-positive-subtle px-3 py-2 text-positive">{message}</p>}
      {error && <p role="alert" className="rounded-md bg-negative-subtle px-3 py-2 text-negative">
        {error.replace(/_/g, ' ')}
      </p>}
    </div>
  );
}
