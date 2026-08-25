import { getServerClient } from '@/lib/db/server';
import { requireSession } from '@/lib/api/guards';
import { internal, notFound, ok } from '@/lib/api/respond';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSession();
  if ('response' in guard) return guard.response;
  const { id } = await params;

  try {
    const supabase = await getServerClient();
    const { data: household } = await supabase
      .from('households').select('id').eq('id', id).maybeSingle();
    if (!household) return notFound('household_not_found');

    const { data: mandates } = await supabase
      .from('mandates')
      .select('*, mandate_allocations(*), mandate_constraints(*), mandate_autonomy(*)')
      .eq('household_id', id)
      .in('status', ['published', 'draft']);

    return ok({
      mandate: mandates?.find((m) => m.status === 'published') ?? null,
      draft: mandates?.find((m) => m.status === 'draft') ?? null,
    });
  } catch (error) {
    return internal(error);
  }
}
