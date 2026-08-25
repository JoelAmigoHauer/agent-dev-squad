import { getServerClient } from '@/lib/db/server';
import { requireSession } from '@/lib/api/guards';
import { internal, notFound, ok } from '@/lib/api/respond';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSession();
  if ('response' in guard) return guard.response;
  const { id } = await params;

  try {
    const supabase = await getServerClient();
    const { data: run } = await supabase.from('agent_runs').select('*').eq('id', id).maybeSingle();
    if (!run) return notFound('run_not_found');

    const [{ data: steps }, { data: observations }, { data: recommendations }] = await Promise.all([
      supabase.from('agent_steps').select('*').eq('run_id', id).order('seq'),
      supabase.from('observations').select('*').eq('run_id', id).order('detected_at'),
      supabase.from('recommendations')
        .select('id, action, rank, status, rationale, stale_data, expires_at')
        .eq('run_id', id).order('rank'),
    ]);

    return ok({
      run,
      steps: steps ?? [],
      observations: observations ?? [],
      recommendations: recommendations ?? [],
    });
  } catch (error) {
    return internal(error);
  }
}
