import { getServerClient } from '@/lib/db/server';
import { requireWriter, isUuid } from '@/lib/api/guards';
import { validateForPublish } from '@/lib/api/mandate';
import { appendLedger } from '@/lib/ledger';
import { conflict, internal, notFound, ok, unprocessable } from '@/lib/api/respond';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireWriter();
  if ('response' in guard) return guard.response;
  const { id } = await params;
  if (!isUuid(id)) return notFound();
  const { session } = guard;

  try {
    const supabase = await getServerClient();

    const { data: draft } = await supabase
      .from('mandates')
      .select('*, mandate_allocations(*), mandate_autonomy(*)')
      .eq('household_id', id).eq('status', 'draft').maybeSingle();
    if (!draft) return notFound('no_draft');

    const { data: positions } = await supabase
      .from('positions').select('market_value, accounts!inner(household_id)')
      .eq('accounts.household_id', id);
    const marketValue = positions?.length
      ? positions.reduce((sum, p) => sum + Number(p.market_value), 0)
      : null;

    const violations = validateForPublish(
      {
        allocations: (draft.mandate_allocations ?? []).map((a) => ({
          assetClass: a.asset_class, targetBps: a.target_bps,
          minBps: a.min_bps, maxBps: a.max_bps,
        })),
        autonomy: (draft.mandate_autonomy ?? []).map((a) => ({
          action: a.action, tier: a.tier,
          maxTradeAmount: a.max_trade_amount, maxDailyAmount: a.max_daily_amount,
        })),
        liquidityNeed: Number(draft.liquidity_need),
      },
      marketValue,
    );
    if (violations.length > 0) {
      const first = violations[0]!;
      return unprocessable(first.error, first.field, { violations });
    }

    const { data: current } = await supabase
      .from('mandates').select('id, version').eq('household_id', id)
      .eq('status', 'published').maybeSingle();

    // Supersede first. The partial unique index allows at most one published mandate per
    // household, so publishing before superseding would be refused by the database — and the
    // order also means a crash between the two leaves zero published mandates rather than two,
    // which is the failure the monitoring cycle can detect and report.
    if (current) {
      const { error } = await supabase
        .from('mandates')
        .update({ status: 'superseded', superseded_at: new Date().toISOString() })
        .eq('id', current.id).eq('status', 'published');
      if (error) return conflict('concurrent_publish', { currentVersion: current.version });
    }

    const { data: published, error: publishError } = await supabase
      .from('mandates')
      .update({
        status: 'published',
        published_at: new Date().toISOString(),
        published_by: session.userId,
      })
      .eq('id', draft.id).eq('status', 'draft')
      .select('*').single();

    if (publishError || !published) {
      return conflict('concurrent_publish', { currentVersion: current?.version ?? null });
    }

    await appendLedger({
      firmId: session.profile.firm_id,
      actor: { type: 'advisor', advisorId: session.userId },
      eventType: 'mandate.published',
      householdId: id,
      subjectType: 'mandate',
      subjectId: published.id,
      payload: {
        version: published.version,
        supersededVersion: current?.version ?? null,
        riskTarget: published.risk_target,
        driftToleranceBps: published.drift_tolerance_bps,
        allocations: (draft.mandate_allocations ?? []).map((a) => ({
          assetClass: a.asset_class, targetBps: a.target_bps,
          minBps: a.min_bps, maxBps: a.max_bps,
        })),
      },
      dataSources: [{ type: 'advisor_input', advisorId: session.userId }],
    });

    return ok({ mandate: published });
  } catch (error) {
    return internal(error);
  }
}
