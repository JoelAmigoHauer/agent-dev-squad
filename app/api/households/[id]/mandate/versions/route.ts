import { getServerClient } from '@/lib/db/server';
import { requireSession } from '@/lib/api/guards';
import { internal, ok } from '@/lib/api/respond';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSession();
  if ('response' in guard) return guard.response;
  const { id } = await params;

  try {
    const supabase = await getServerClient();
    const { data } = await supabase
      .from('mandates')
      .select('*, mandate_allocations(*)')
      .eq('household_id', id)
      .neq('status', 'draft')
      .order('version', { ascending: false });

    const versions = (data ?? []).map((m, index, all) => ({
      version: m.version,
      status: m.status,
      publishedAt: m.published_at,
      publishedBy: m.published_by,
      riskTarget: m.risk_target,
      driftToleranceBps: m.drift_tolerance_bps,
      allocations: m.mandate_allocations ?? [],
      diff: diffAgainst(m, all[index + 1]),
    }));

    return ok({ versions });
  } catch (error) {
    return internal(error);
  }
}

type Row = { risk_target: number; drift_tolerance_bps: number; min_cash_bps: number;
             tax_sensitivity: string; min_trade_amount: number };

/** Field-level diff against the previous version. Null for the first, which has nothing to differ from. */
function diffAgainst(current: Row, previous: Row | undefined) {
  if (!previous) return null;
  const fields: (keyof Row)[] = [
    'risk_target', 'drift_tolerance_bps', 'min_cash_bps', 'tax_sensitivity', 'min_trade_amount',
  ];
  const changed: { field: string; from: unknown; to: unknown }[] = [];
  for (const field of fields) {
    if (current[field] !== previous[field]) {
      changed.push({ field, from: previous[field], to: current[field] });
    }
  }
  return changed;
}
