import type { ReactNode } from 'react';

/**
 * Shared components, built once. design.md §3 names every element that appears on more than one
 * screen, because build 1 cloned a nav rail across four screens and the fourth is the one that
 * got missed.
 */

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-border bg-surface ${className}`}>{children}</div>
  );
}

export function CardHeader({ title, action }: { title: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border px-5 py-3">
      <h2 className="text-md font-semibold">{title}</h2>
      {action}
    </div>
  );
}

type PillTone = 'neutral' | 'positive' | 'negative' | 'warning' | 'info' | 'accent';

const PILL_TONES: Record<PillTone, string> = {
  neutral:  'bg-neutral-subtle text-neutral',
  positive: 'bg-positive-subtle text-positive',
  negative: 'bg-negative-subtle text-negative',
  warning:  'bg-warning-subtle text-warning',
  info:     'bg-info-subtle text-info',
  accent:   'bg-accent-subtle text-accent',
};

/** One component with variants — every status in the system renders through this. */
export function StatusPill({ status }: { status: string }) {
  const tone = STATUS_TONE[status] ?? 'neutral';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${PILL_TONES[tone]}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

const STATUS_TONE: Record<string, PillTone> = {
  pending: 'info', approved: 'positive', modified_approved: 'positive',
  rejected: 'negative', expired: 'neutral', auto_executed: 'warning',
  running: 'info', complete: 'positive', failed: 'negative',
  draft: 'neutral', published: 'positive', superseded: 'neutral',
  connected: 'positive', error: 'negative', revoked: 'negative',
  critical: 'negative', warning: 'warning', info: 'info',
};

export function SeverityDot({ severity }: { severity: string }) {
  const colour = severity === 'critical' ? 'bg-negative'
    : severity === 'warning' ? 'bg-warning' : 'bg-info';
  return <span className={`inline-block h-2 w-2 rounded-full ${colour}`} aria-label={severity} />;
}

export function formatMoney(value: number | string | null | undefined): string {
  const n = typeof value === 'string' ? Number(value) : value ?? 0;
  return n.toLocaleString('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
}

export function formatBps(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

export function MoneyCell({ value }: { value: number | string | null | undefined }) {
  const n = typeof value === 'string' ? Number(value) : value ?? 0;
  const tone = n < 0 ? 'text-negative' : '';
  return <span className={`tabular ${tone}`}>{formatMoney(n)}</span>;
}

export function BpsCell({ bps, signed = false }: { bps: number; signed?: boolean }) {
  const tone = !signed ? '' : bps > 0 ? 'text-warning' : bps < 0 ? 'text-info' : 'text-text-muted';
  const prefix = signed && bps > 0 ? '+' : '';
  return <span className={`tabular ${tone}`}>{prefix}{formatBps(bps)}</span>;
}

/**
 * A bar showing actual against a target INSIDE a tolerance band. A progress bar shows one value
 * against a maximum, which is a different picture — hence hand-built (design.md §4).
 */
export function DriftBar({
  actualBps, targetBps, minBps, maxBps, breached,
}: { actualBps: number; targetBps: number; minBps: number; maxBps: number; breached: boolean }) {
  // Render window is the band plus a margin, so a breach is visible outside the band rather than
  // clipped at the edge where it would look like a boundary case.
  const lo = Math.max(0, Math.min(minBps, actualBps) - 200);
  const hi = Math.max(maxBps, actualBps) + 200;
  const span = Math.max(1, hi - lo);
  const pct = (v: number) => `${(((v - lo) / span) * 100).toFixed(2)}%`;

  return (
    <div className="relative h-6 w-full rounded bg-surface-sunken" role="img"
         aria-label={`actual ${formatBps(actualBps)}, target ${formatBps(targetBps)}, band ${formatBps(minBps)} to ${formatBps(maxBps)}`}>
      <div className="absolute inset-y-0 rounded bg-accent-subtle"
           style={{ left: pct(minBps), right: `calc(100% - ${pct(maxBps)})` }} />
      <div className="absolute inset-y-0 w-px bg-border-strong" style={{ left: pct(targetBps) }} />
      <div className={`absolute inset-y-1 w-1 rounded ${breached ? 'bg-negative' : 'bg-positive'}`}
           style={{ left: pct(actualBps) }} />
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <p className="text-md font-medium">{title}</p>
      <p className="max-w-md text-text-muted">{body}</p>
      {action}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-negative bg-negative-subtle px-4 py-3 text-negative">
      {message}
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-surface-sunken ${className}`} />;
}
