import { getServerClient } from '@/lib/db/server';
import { requireWriter } from '@/lib/api/guards';
import { draftSchema } from '@/lib/api/mandate';
import { internal, notFound, ok, unprocessable } from '@/lib/api/respond';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireWriter();
  if ('response' in guard) return guard.response;
  const { id } = await params;
  const { session } = guard;

  const parsed = draftSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return unprocessable('validation', issue?.path.join('.') ?? undefined, issue?.message);
  }
  const body = parsed.data;

  try {
    const supabase = await getServerClient();
    const { data: household } = await supabase
      .from('households').select('id').eq('id', id).maybeSingle();
    if (!household) return notFound('household_not_found');

    let { data: draft } = await supabase
      .from('mandates').select('id, version').eq('household_id', id).eq('status', 'draft').maybeSingle();

    if (!draft) {
      const { data: latest } = await supabase
        .from('mandates').select('version').eq('household_id', id)
        .order('version', { ascending: false }).limit(1).maybeSingle();
      const { data: created, error } = await supabase
        .from('mandates')
        .insert({
          firm_id: session.profile.firm_id, household_id: id,
          version: (latest?.version ?? 0) + 1, status: 'draft',
          created_by: session.userId, objective: body.objective ?? '',
        })
        .select('id, version').single();
      if (error) return internal(error);
      draft = created;
    }

    const patch = {
      ...(body.objective !== undefined && { objective: body.objective }),
      ...(body.riskTarget !== undefined && { risk_target: body.riskTarget }),
      ...(body.maxDrawdownBps !== undefined && { max_drawdown_bps: body.maxDrawdownBps }),
      ...(body.taxSensitivity !== undefined && { tax_sensitivity: body.taxSensitivity }),
      ...(body.realizedGainBudget !== undefined && { realized_gain_budget: body.realizedGainBudget }),
      ...(body.minCashBps !== undefined && { min_cash_bps: body.minCashBps }),
      ...(body.liquidityNeed !== undefined && { liquidity_need: body.liquidityNeed }),
      ...(body.liquidityBy !== undefined && { liquidity_by: body.liquidityBy }),
      ...(body.rebalanceTrigger !== undefined && { rebalance_trigger: body.rebalanceTrigger }),
      ...(body.driftToleranceBps !== undefined && { drift_tolerance_bps: body.driftToleranceBps }),
      ...(body.minTradeAmount !== undefined && { min_trade_amount: body.minTradeAmount }),
      ...(body.priceStalenessHours !== undefined && { price_staleness_hours: body.priceStalenessHours }),
    };
    if (Object.keys(patch).length > 0) {
      const { error } = await supabase.from('mandates').update(patch).eq('id', draft.id);
      if (error) return internal(error);
    }

    // Child collections are replaced wholesale when supplied. The editor always sends a complete
    // set for the step it just finished, and merging partial sets would leave an allocation the
    // advisor deleted still in the mandate.
    if (body.allocations) {
      await supabase.from('mandate_allocations').delete().eq('mandate_id', draft.id);
      if (body.allocations.length) {
        const { error } = await supabase.from('mandate_allocations').insert(
          body.allocations.map((a) => ({
            mandate_id: draft.id, asset_class: a.assetClass,
            target_bps: a.targetBps, min_bps: a.minBps, max_bps: a.maxBps,
          })),
        );
        if (error) return unprocessable('band_disordered', 'allocations', error.message);
      }
    }
    if (body.constraints) {
      await supabase.from('mandate_constraints').delete().eq('mandate_id', draft.id);
      if (body.constraints.length) {
        const { error } = await supabase.from('mandate_constraints').insert(
          body.constraints.map((c) => ({
            mandate_id: draft.id, kind: c.kind, security_id: c.securityId ?? null,
            sector: c.sector ?? null, limit_bps: c.limitBps ?? null, note: c.note ?? null,
          })),
        );
        if (error) return unprocessable('constraint_shape', 'constraints', error.message);
      }
    }
    if (body.autonomy) {
      await supabase.from('mandate_autonomy').delete().eq('mandate_id', draft.id);
      if (body.autonomy.length) {
        const { error } = await supabase.from('mandate_autonomy').insert(
          body.autonomy.map((a) => ({
            mandate_id: draft.id, action: a.action, tier: a.tier,
            max_trade_amount: a.maxTradeAmount ?? null, max_daily_amount: a.maxDailyAmount ?? null,
          })),
        );
        // The database refuses an unbounded auto_execute tier outright. Surfacing it as a 422
        // keeps the API contract's error vocabulary rather than leaking a constraint name.
        if (error) return unprocessable('unbounded_autonomy', 'autonomy', error.message);
      }
    }

    const { data: full } = await supabase
      .from('mandates')
      .select('*, mandate_allocations(*), mandate_constraints(*), mandate_autonomy(*)')
      .eq('id', draft.id).single();

    return ok({ draft: full });
  } catch (error) {
    return internal(error);
  }
}
