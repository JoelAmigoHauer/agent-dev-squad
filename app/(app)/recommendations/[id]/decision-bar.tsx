'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader } from '@/components/ui/primitives';

type Mode = 'idle' | 'approving' | 'rejecting' | 'submitting';

export function DecisionBar({ id, staleData }: { id: string; staleData: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('idle');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function post(path: string, body: unknown) {
    setMode('submitting');
    setError(null);
    const response = await fetch(`/api/recommendations/${id}/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string; detail?: unknown };
      setError(payload.error ?? `failed (${response.status})`);
      setMode('idle');
      return;
    }
    router.refresh();
  }

  return (
    <Card>
      <CardHeader title="Decision" />
      <div className="space-y-3 px-5 py-4">
        {staleData && (
          <p className="rounded-md bg-warning-subtle px-3 py-2 text-warning">
            Prices behind this recommendation are older than the mandate allows. Approval is
            blocked; rejecting is still available.
          </p>
        )}

        {mode === 'rejecting' ? (
          <>
            <label className="block">
              <span className="text-text-muted">Reason (required)</span>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
                        className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2" />
            </label>
            <div className="flex gap-2">
              <button disabled={!reason.trim()} onClick={() => post('reject', { reason })}
                      className="flex-1 rounded-md bg-negative px-3 py-2 font-medium text-white disabled:opacity-60">
                Confirm rejection
              </button>
              <button onClick={() => setMode('idle')} className="rounded-md border border-border px-3 py-2">
                Cancel
              </button>
            </div>
          </>
        ) : (
          <div className="space-y-2">
            <button
              disabled={staleData || mode === 'submitting'}
              onClick={() => post('approve', {})}
              className="w-full rounded-md bg-accent px-3 py-2 font-medium text-white disabled:opacity-60">
              {mode === 'submitting' ? 'Submitting…' : 'Approve'}
            </button>
            <button onClick={() => setMode('rejecting')} disabled={mode === 'submitting'}
                    className="w-full rounded-md border border-border px-3 py-2 disabled:opacity-60">
              Reject
            </button>
          </div>
        )}

        {error && (
          <p role="alert" className="rounded-md bg-negative-subtle px-3 py-2 text-negative">
            {error.replace(/_/g, ' ')}
          </p>
        )}
      </div>
    </Card>
  );
}
