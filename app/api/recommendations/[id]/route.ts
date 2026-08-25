import { getServerClient } from '@/lib/db/server';
import { requireSession, isUuid } from '@/lib/api/guards';
import { internal, notFound, ok } from '@/lib/api/respond';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSession();
  if ('response' in guard) return guard.response;
  const { id } = await params;
  if (!isUuid(id)) return notFound();

  try {
    const supabase = await getServerClient();
    const { data: recommendation } = await supabase
      .from('recommendations').select('*').eq('id', id).maybeSingle();
    if (!recommendation) return notFound('recommendation_not_found');

    const [{ data: legs }, { data: mandate }] = await Promise.all([
      supabase.from('recommendation_legs')
        .select('*, securities(symbol, name), accounts(display_name, tax_treatment)')
        .eq('recommendation_id', id).eq('superseded', false).order('seq'),
      supabase.from('mandates')
        .select('id, version, status, drift_tolerance_bps, min_cash_bps, tax_sensitivity')
        .eq('id', recommendation.mandate_id).maybeSingle(),
    ]);

    return ok({
      recommendation,
      legs: legs ?? [],
      mandate,
      guardrail: recommendation.guardrail_result,
      provenance: recommendation.provenance,
    });
  } catch (error) {
    return internal(error);
  }
}
