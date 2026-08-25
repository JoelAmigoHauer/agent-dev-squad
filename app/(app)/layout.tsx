import { redirect } from 'next/navigation';
import { getAdvisorSession } from '@/lib/db/session';
import { AppShell } from '@/components/ui/shell';

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdvisorSession();
  if (!session) redirect('/sign-in');

  return (
    <AppShell
      firmName={session.firm.name}
      advisorName={`${session.profile.full_name} · ${session.profile.role}`}
      shadowMode={session.firm.shadow_mode}
    >
      {children}
    </AppShell>
  );
}
