'use client';

import { useState } from 'react';

type Verify =
  | { intact: true; entries: number; headHash: string }
  | { intact: false; firstDivergentSeq: number; expected: string; found: string };

export function LedgerTools() {
  const [result, setResult] = useState<Verify | null>(null);
  const [busy, setBusy] = useState(false);

  async function verify() {
    setBusy(true);
    const response = await fetch('/api/ledger/verify');
    setResult(await response.json());
    setBusy(false);
  }

  return (
    <div className="text-right">
      <div className="flex gap-2">
        <a href="/api/ledger/export"
           className="rounded-md border border-border px-3 py-2">Export CSV</a>
        <button onClick={verify} disabled={busy}
                className="rounded-md bg-accent px-3 py-2 font-medium text-white disabled:opacity-60">
          {busy ? 'Verifying…' : 'Verify chain'}
        </button>
      </div>

      {/* The broken state is designed, not an error toast. It is the most important thing this
          screen can ever say. design.md S8. */}
      {result && (
        result.intact ? (
          <p className="mt-2 rounded-md bg-positive-subtle px-3 py-2 text-left text-positive">
            Chain intact across {result.entries} entries.
            <span className="ml-2 font-mono text-xs">head {result.headHash.slice(0, 16)}…</span>
          </p>
        ) : (
          <div className="mt-2 rounded-md border border-negative bg-negative-subtle px-3 py-2 text-left text-negative">
            <p className="font-semibold">Chain broken at entry {result.firstDivergentSeq}.</p>
            <p className="mt-1 font-mono text-xs">expected {result.expected.slice(0, 24)}…</p>
            <p className="font-mono text-xs">found&nbsp;&nbsp;&nbsp; {result.found.slice(0, 24)}…</p>
            <p className="mt-1">This ledger has been altered outside the application. Preserve it and escalate.</p>
          </div>
        )
      )}
    </div>
  );
}
