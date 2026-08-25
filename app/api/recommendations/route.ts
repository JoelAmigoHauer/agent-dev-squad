import { getServerClient } from '@/lib/db/server';
import { requireSession } from '@/lib/api/guards';
import { internal, ok } from '@/lib/api/respond';

export async function GET(req: Request) {
  const guard = await requireSession();
  if ('response' in guard) return guard.response;

  try {
    const url = new URL(req.url);
    const householdId = url.searchParams.get('householdId');
    const status = url.searchParams.get('status');

    const supabase = await getServerClient();
    let query = supabase
      .from('recommendations')
      .select('id, household_id, action, rank, status, rationale, stale_data, expires_at, created_at, projected_drift_bps_before, projected_drift_bps_after')
      .order('rank', { ascending: true });
    if (householdId) query = query.eq('household_id', householdId);
    if (status) query = query.eq('status', status as never);

    const { data, error } = await query;
    if (error) return internal(error);
    return ok({ recommendations: data ?? [] });
  } catch (error) {
    return internal(error);
  }
}
