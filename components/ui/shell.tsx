import Link from 'next/link';
import type { ReactNode } from 'react';

const NAV = [
  { href: '/', label: 'Dashboard' },
  { href: '/households', label: 'Households' },
  { href: '/ledger', label: 'Decision ledger' },
  { href: '/settings', label: 'Settings' },
] as const;

/**
 * ShadowModeBanner lives INSIDE AppShell, not on each screen. A banner an engineer has to
 * remember to add is a banner that will be missing from exactly the screen where it mattered.
 * design.md §3.
 */
export function AppShell({
  children, firmName, advisorName, shadowMode,
}: { children: ReactNode; firmName: string; advisorName: string; shadowMode: boolean }) {
  return (
    <div className="flex min-h-screen">
      <nav className="flex w-56 shrink-0 flex-col border-r border-border bg-surface">
        <div className="border-b border-border px-5 py-4">
          <p className="text-lg font-semibold tracking-tight">Thelma</p>
          <p className="text-xs text-text-subtle">{firmName}</p>
        </div>
        <ul className="flex-1 space-y-1 p-3">
          {NAV.map((item) => (
            <li key={item.href}>
              <Link href={item.href}
                    className="block rounded-md px-3 py-2 text-text-muted hover:bg-surface-sunken hover:text-text">
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="border-t border-border px-5 py-3 text-xs text-text-subtle">{advisorName}</div>
      </nav>

      <main className="flex-1 overflow-x-auto">
        {shadowMode && <ShadowModeBanner />}
        <div className="mx-auto max-w-[1400px] p-6">{children}</div>
      </main>
    </div>
  );
}

function ShadowModeBanner() {
  return (
    <div className="border-b border-warning bg-warning-subtle px-6 py-2 text-warning" role="status">
      <strong className="font-semibold">Shadow mode is on.</strong>{' '}
      Recommendations are generated and reviewable. No order can leave the system.
    </div>
  );
}

export function PageHeader({
  title, subtitle, action,
}: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <header className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <div className="mt-1 text-text-muted">{subtitle}</div>}
      </div>
      {action}
    </header>
  );
}
