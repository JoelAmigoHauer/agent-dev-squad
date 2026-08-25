import { notFound } from 'next/navigation';
import { getServerClient } from '@/lib/db/server';
import { PageHeader } from '@/components/ui/shell';
import { MandateEditor } from './editor';

export const dynamic = 'force-dynamic';

export default async function MandatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getServerClient();

  const { data: household } = await supabase
    .from('households').select('id, name').eq('id', id).maybeSingle();
  if (!household) notFound();

  const { data: mandates } = await supabase
    .from('mandates')
    .select('*, mandate_allocations(*), mandate_constraints(*), mandate_autonomy(*)')
    .eq('household_id', id).in('status', ['published', 'draft']);

  const published = mandates?.find((m) => m.status === 'published') ?? null;
  const draft = mandates?.find((m) => m.status === 'draft') ?? null;

  return (
    <>
      <PageHeader
        title="Configure mandate"
        subtitle={
          <span>
            {household.name}
            {published && (
              <span className="ml-2 text-text-subtle">
                · currently published: v{published.version}
              </span>
            )}
          </span>
        }
      />
      <MandateEditor householdId={id} draft={draft} published={published} />
    </>
  );
}
