/**
 * One loader for the household facts every deterministic path needs — drift, the graph, and the
 * guardrail engine on modification.
 *
 * Deliberately shared: three separate loaders assembling "the same" context is how the drift the
 * advisor sees on screen starts disagreeing with the drift a recommendation was reasoned against.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/db/database.types';
import { fromDb, ZERO, type Money } from '@/lib/domain/money';
import type { GuardrailContext } from '@/lib/guardrails/types';

type Client = SupabaseClient<Database>;

export interface HouseholdFacts {
  household: { id: string; name: string; firm_id: string };
  mandate: { id: string; version: number } | null;
  ctx: GuardrailContext;
  symbolsById: Map<string, string>;
  pricesBySecurityId: Map<string, number>;
  /** newest position timestamp, or null when nothing has been imported */
  asOf: string | null;
  priceAsOf: string | null;
}

export async function loadHouseholdFacts(
  supabase: Client,
  householdId: string,
  opts: { isExecutionAttempt?: boolean } = {},
): Promise<HouseholdFacts | null> {
  const { data: household } = await supabase
    .from('households').select('id, name, firm_id').eq('id', householdId).maybeSingle();
  if (!household) return null;

  const { data: firm } = await supabase
    .from('firms').select('shadow_mode').eq('id', household.firm_id).maybeSingle();

  const { data: accounts } = await supabase
    .from('accounts').select('*').eq('household_id', householdId);
  const accountIds = (accounts ?? []).map((a) => a.id);

  const { data: mandateRow } = await supabase
    .from('mandates')
    .select('*, mandate_allocations(*), mandate_constraints(*), mandate_autonomy(*)')
    .eq('household_id', householdId).eq('status', 'published').maybeSingle();

  // Positions are dated snapshots, so "current" means the newest as_of, not every row.
  let positions: Database['public']['Tables']['positions']['Row'][] = [];
  let asOf: string | null = null;
  if (accountIds.length > 0) {
    const { data: latest } = await supabase
      .from('positions').select('as_of').in('account_id', accountIds)
      .order('as_of', { ascending: false }).limit(1).maybeSingle();
    asOf = latest?.as_of ?? null;
    if (asOf) {
      const { data } = await supabase
        .from('positions').select('*').in('account_id', accountIds).eq('as_of', asOf);
      positions = data ?? [];
    }
  }

  const securityIds = [...new Set(positions.map((p) => p.security_id))];
  const { data: securities } = securityIds.length
    ? await supabase.from('securities').select('*').in('id', securityIds)
    : { data: [] as Database['public']['Tables']['securities']['Row'][] };

  // Every security the mandate mentions must be loadable too, or a prohibited-security rule
  // silently passes because the engine has never heard of the security it forbids.
  const constraintSecurityIds = (mandateRow?.mandate_constraints ?? [])
    .map((c) => c.security_id).filter((id): id is string => !!id && !securityIds.includes(id));
  const { data: extraSecurities } = constraintSecurityIds.length
    ? await supabase.from('securities').select('*').in('id', constraintSecurityIds)
    : { data: [] as Database['public']['Tables']['securities']['Row'][] };

  const allSecurities = [...(securities ?? []), ...(extraSecurities ?? [])];

  const pricesBySecurityId = new Map<string, number>();
  let priceAsOf: string | null = null;
  if (allSecurities.length) {
    const { data: prices } = await supabase
      .from('security_prices').select('*')
      .in('security_id', allSecurities.map((s) => s.id))
      .order('price_date', { ascending: false });
    for (const price of prices ?? []) {
      if (!pricesBySecurityId.has(price.security_id)) {
        pricesBySecurityId.set(price.security_id, Number(price.close_price));
        if (!priceAsOf || price.price_date > priceAsOf) priceAsOf = price.price_date;
      }
    }
  }

  // Realised gains booked this calendar year, for guardrail rule 7.
  const yearStart = `${new Date().getUTCFullYear()}-01-01`;
  const taxableAccountIds = (accounts ?? [])
    .filter((a) => a.tax_treatment === 'taxable').map((a) => a.id);
  let realizedGainYtd: Money = ZERO;
  if (taxableAccountIds.length) {
    const { data: sells } = await supabase
      .from('transactions').select('amount')
      .in('account_id', taxableAccountIds).eq('txn_type', 'sell').gte('trade_date', yearStart);
    // Proceeds, not gain — v1.0 has no lot selection, so this is a deliberately conservative
    // over-estimate of the budget consumed. Noted in build-notes.md as a v1.1 refinement.
    realizedGainYtd = (sells ?? []).reduce(
      (sum, t) => (sum + fromDb(t.amount)) as Money, ZERO,
    );
  }

  const ctx: GuardrailContext = {
    action: 'rebalance_trade',
    mandate: {
      id: mandateRow?.id ?? '',
      version: mandateRow?.version ?? 0,
      bands: (mandateRow?.mandate_allocations ?? []).map((a) => ({
        assetClass: a.asset_class, targetBps: a.target_bps, minBps: a.min_bps, maxBps: a.max_bps,
      })),
      minCashBps: mandateRow?.min_cash_bps ?? 0,
      liquidityNeed: fromDb(mandateRow?.liquidity_need ?? 0),
      minTradeAmount: fromDb(mandateRow?.min_trade_amount ?? 0),
      realizedGainBudget: mandateRow?.realized_gain_budget !== null
        && mandateRow?.realized_gain_budget !== undefined
        ? fromDb(mandateRow.realized_gain_budget) : null,
      driftToleranceBps: mandateRow?.drift_tolerance_bps ?? 500,
      constraints: (mandateRow?.mandate_constraints ?? []).map((c) => ({
        kind: c.kind, securityId: c.security_id, sector: c.sector, limitBps: c.limit_bps,
      })),
      autonomy: (mandateRow?.mandate_autonomy ?? []).map((a) => ({
        action: a.action, tier: a.tier,
        maxTradeAmount: a.max_trade_amount !== null ? fromDb(a.max_trade_amount) : null,
        maxDailyAmount: a.max_daily_amount !== null ? fromDb(a.max_daily_amount) : null,
      })),
    },
    accounts: (accounts ?? []).map((a) => ({
      id: a.id, taxTreatment: a.tax_treatment, cashBalance: fromDb(a.cash_balance),
    })),
    securities: allSecurities.map((s) => ({
      id: s.id, symbol: s.symbol, assetClass: s.asset_class, sector: s.sector,
    })),
    positions: positions.map((p) => ({
      accountId: p.account_id, securityId: p.security_id, quantity: Number(p.quantity),
      marketValue: fromDb(p.market_value), costBasis: fromDb(p.cost_basis),
    })),
    realizedGainYtd,
    autoExecutedTodayAmount: ZERO,
    shadowMode: firm?.shadow_mode ?? true,
    isExecutionAttempt: opts.isExecutionAttempt ?? false,
  };

  return {
    household,
    mandate: mandateRow ? { id: mandateRow.id, version: mandateRow.version } : null,
    ctx,
    symbolsById: new Map(allSecurities.map((s) => [s.id, s.symbol])),
    pricesBySecurityId,
    asOf,
    priceAsOf,
  };
}
