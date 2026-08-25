'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function RunCycleButton({ householdId }: { householdId: string }) {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'running'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setState('running');
    setError(null);
    const response = await fetch(`/api/households/${householdId}/runs`, { method: 'POST' });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      // Surfaced verbatim: `no_published_mandate` and `run_in_progress` need different actions
      // from the advisor, and a generic failure message hides which one happened.
      setError(body.error ?? `failed (${response.status})`);
      setState('idle');
      return;
    }
    setState('idle');
    router.refresh();
  }

  return (
    <div className="text-right">
      <button onClick={run} disabled={state === 'running'}
              className="rounded-md bg-accent px-4 py-2 font-medium text-white disabled:opacity-60">
        {state === 'running' ? 'Running cycle…' : 'Run monitoring cycle'}
      </button>
      {error && <p role="alert" className="mt-1 text-xs text-negative">{error.replace(/_/g, ' ')}</p>}
    </div>
  );
}
