/**
 * The guardrail engine — contract.md §3.
 *
 * Deterministic. Runs after the model has proposed and before anything is persisted as
 * actionable, and again on every advisor modification. It is the layer that makes "probabilistic
 * reasoning bounded by deterministic guardrails" true rather than aspirational.
 *
 * Two properties this file must keep:
 *
 * 1. ALL eleven rules are evaluated, always. It never short-circuits on the first failure.
 *    A breach report that stops at the first problem sends the advisor round the loop once per
 *    breach, and — more importantly — a result carrying only failures cannot distinguish
 *    "rule 7 checked and fine" from "rule 7 never ran". An examiner needs to see the difference.
 *
 * 2. It calls no model, makes no network request, and reads no clock it was not given.
 *    Same inputs, same result, forever. QA depends on that and so does the audit.
 */

import { FULL_BPS, ZERO, add, bpsOf, fromInput, shareBps, sub, type Money } from '@/lib/domain/money';
import { computeDrift, type AssetClass } from '@/lib/domain/drift';
import type {
  GuardrailContext,
  GuardrailResult,
  ProposedLeg,
  RuleOutcome,
} from './types';

const RULE_NAMES: Record<number, string> = {
  1: 'no leg buys a prohibited security',
  2: 'no leg buys into a prohibited sector',
  3: 'post-trade class weights stay within their bands',
  4: 'post-trade single-position weight within concentration cap',
  5: 'post-trade cash covers minimum and liquidity need',
  6: 'hold_minimum positions not sold below their floor',
  7: 'realised gains within the annual budget',
  8: 'no tax-loss harvest in a non-taxable account',
  9: 'each leg meets the minimum trade amount',
  10: 'auto-execute stays within its bounds',
  11: 'shadow mode blocks execution',
};

/** Signed cash effect of a leg: a sell adds cash, a buy consumes it. */
function cashDelta(leg: ProposedLeg): Money {
  return (leg.side === 'sell' ? leg.estAmount : -leg.estAmount) as Money;
}

/** Signed position-value effect of a leg. The mirror of cashDelta. */
function positionDelta(leg: ProposedLeg): Money {
  return (leg.side === 'buy' ? leg.estAmount : -leg.estAmount) as Money;
}

export function evaluateGuardrails(
  legs: ProposedLeg[],
  ctx: GuardrailContext,
): GuardrailResult {
  const outcomes: RuleOutcome[] = [];
  const securityById = new Map(ctx.securities.map((s) => [s.id, s]));
  const accountById = new Map(ctx.accounts.map((a) => [a.id, a]));

  const record = (rule: number, pass: boolean, detail?: unknown) =>
    outcomes.push({ rule, name: RULE_NAMES[rule]!, pass, detail });

  // --- rule 1: prohibited securities -------------------------------------
  {
    const prohibited = new Set(
      ctx.mandate.constraints
        .filter((c) => c.kind === 'prohibited_security' && c.securityId)
        .map((c) => c.securityId!),
    );
    const hits = legs.filter((l) => l.side === 'buy' && prohibited.has(l.securityId));
    record(1, hits.length === 0, hits.length ? { securities: hits.map((h) => h.securityId) } : undefined);
  }

  // --- rule 2: prohibited sectors ----------------------------------------
  {
    const prohibited = new Set(
      ctx.mandate.constraints
        .filter((c) => c.kind === 'prohibited_sector' && c.sector)
        .map((c) => c.sector!.toLowerCase()),
    );
    const hits = legs.filter((l) => {
      if (l.side !== 'buy') return false;
      const sector = securityById.get(l.securityId)?.sector;
      return sector ? prohibited.has(sector.toLowerCase()) : false;
    });
    record(2, hits.length === 0, hits.length ? { sectors: [...prohibited] } : undefined);
  }

  // --- post-trade portfolio, shared by rules 3, 4 and 5 -------------------
  const postTrade = projectPostTrade(legs, ctx);

  // --- rule 3: class bands ------------------------------------------------
  {
    const report = computeDrift(
      [...postTrade.byAssetClass].map(([assetClass, marketValue]) => ({ assetClass, marketValue })),
      ctx.mandate.bands,
      postTrade.cash,
    );
    const breached = report.bands.filter((b) => b.breached);
    record(3, breached.length === 0, breached.length
      ? { breached: breached.map((b) => ({
          assetClass: b.assetClass, actualBps: b.actualBps, minBps: b.minBps, maxBps: b.maxBps,
        })) }
      : undefined);
  }

  // --- rule 4: concentration cap -----------------------------------------
  {
    const caps = ctx.mandate.constraints.filter(
      (c) => c.kind === 'concentration_cap' && c.limitBps !== null,
    );
    const over: unknown[] = [];
    if (caps.length > 0 && postTrade.total > 0) {
      // A cap with no securityId is a portfolio-wide cap on every single position.
      for (const [securityId, value] of postTrade.bySecurity) {
        const bps = shareBps(value, postTrade.total);
        for (const cap of caps) {
          if (cap.securityId && cap.securityId !== securityId) continue;
          if (bps > cap.limitBps!) {
            over.push({ securityId, actualBps: bps, limitBps: cap.limitBps });
          }
        }
      }
    }
    record(4, over.length === 0, over.length ? { over } : undefined);
  }

  // --- rule 5: cash floor and liquidity ----------------------------------
  {
    const requiredFloor = bpsOf(postTrade.total, ctx.mandate.minCashBps);
    const required = add(requiredFloor, ctx.mandate.liquidityNeed);
    const pass = postTrade.cash >= required;
    record(5, pass, pass ? undefined : {
      postTradeCash: postTrade.cash, minCashBps: ctx.mandate.minCashBps,
      liquidityNeed: ctx.mandate.liquidityNeed, required,
    });
  }

  // --- rule 6: hold minimums ---------------------------------------------
  {
    const floors = ctx.mandate.constraints.filter(
      (c) => c.kind === 'hold_minimum' && c.securityId && c.limitBps !== null,
    );
    const violated: unknown[] = [];
    for (const floor of floors) {
      const value = postTrade.bySecurity.get(floor.securityId!) ?? ZERO;
      const bps = shareBps(value, postTrade.total);
      if (bps < floor.limitBps!) {
        violated.push({ securityId: floor.securityId, actualBps: bps, floorBps: floor.limitBps });
      }
    }
    record(6, violated.length === 0, violated.length ? { violated } : undefined);
  }

  // --- rule 7: realised gain budget --------------------------------------
  {
    const budget = ctx.mandate.realizedGainBudget;
    if (budget === null) {
      record(7, true, { budget: null });
    } else {
      const projected = add(ctx.realizedGainYtd, estimateRealizedGain(legs, ctx));
      const pass = projected <= budget;
      record(7, pass, pass ? undefined : { realizedGainYtd: ctx.realizedGainYtd, projected, budget });
    }
  }

  // --- rule 8: no harvesting in a sheltered account ----------------------
  {
    const offenders = ctx.action !== 'tax_loss_harvest' ? [] : legs.filter((l) => {
      const account = accountById.get(l.accountId);
      return !account || account.taxTreatment !== 'taxable';
    });
    record(8, offenders.length === 0, offenders.length
      ? { accounts: offenders.map((o) => o.accountId) }
      : undefined);
    // Harvesting a loss inside an IRA achieves nothing — the loss is not deductible — while still
    // incurring the trade. It is not merely suboptimal, it is a mistake an advisor would be asked
    // to explain, so it is a hard rule rather than a ranking penalty.
  }

  // --- rule 9: minimum trade amount --------------------------------------
  {
    const tooSmall = legs.filter((l) => l.estAmount < ctx.mandate.minTradeAmount);
    record(9, tooSmall.length === 0, tooSmall.length
      ? { minTradeAmount: ctx.mandate.minTradeAmount,
          legs: tooSmall.map((l) => ({ securityId: l.securityId, estAmount: l.estAmount })) }
      : undefined);
  }

  // --- rule 10: auto-execute bounds --------------------------------------
  {
    const autonomy = ctx.mandate.autonomy.find((a) => a.action === ctx.action);
    if (!ctx.isExecutionAttempt || autonomy?.tier !== 'auto_execute') {
      // Not an execution attempt, or not an auto-execute action: the rule is satisfied but it was
      // still evaluated, and the detail says which it was so the record is unambiguous.
      record(10, true, { tier: autonomy?.tier ?? 'propose', executionAttempt: ctx.isExecutionAttempt });
    } else {
      const total = add(...legs.map((l) => l.estAmount));
      const overPerTrade = legs.filter(
        (l) => autonomy.maxTradeAmount !== null && l.estAmount > autonomy.maxTradeAmount,
      );
      const projectedDaily = add(ctx.autoExecutedTodayAmount, total);
      const overDaily =
        autonomy.maxDailyAmount !== null && projectedDaily > autonomy.maxDailyAmount;
      const pass = overPerTrade.length === 0 && !overDaily;
      record(10, pass, pass ? undefined : {
        maxTradeAmount: autonomy.maxTradeAmount, maxDailyAmount: autonomy.maxDailyAmount,
        projectedDaily, overPerTrade: overPerTrade.length,
      });
    }
  }

  // --- rule 11: shadow mode ----------------------------------------------
  {
    const pass = !(ctx.shadowMode && ctx.isExecutionAttempt);
    record(11, pass, pass ? { shadowMode: ctx.shadowMode } : { shadowMode: true });
  }

  const breaches = outcomes.filter((o) => !o.pass);
  return {
    pass: breaches.length === 0,
    rulesEvaluated: outcomes.sort((a, b) => a.rule - b.rule),
    breaches,
  };
}

interface PostTrade {
  byAssetClass: Map<AssetClass, Money>;
  bySecurity: Map<string, Money>;
  cash: Money;
  total: Money;
}

/**
 * Applies the legs to current holdings at estimated prices. Estimated, because these are proposed
 * trades that have not executed — every downstream number derived from this is a projection and
 * is labelled as such in the UI.
 */
function projectPostTrade(legs: ProposedLeg[], ctx: GuardrailContext): PostTrade {
  const securityById = new Map(ctx.securities.map((s) => [s.id, s]));
  const bySecurity = new Map<string, Money>();

  for (const p of ctx.positions) {
    bySecurity.set(p.securityId, add(bySecurity.get(p.securityId) ?? ZERO, p.marketValue));
  }
  for (const leg of legs) {
    const current = bySecurity.get(leg.securityId) ?? ZERO;
    const next = add(current, positionDelta(leg));
    // Clamped at zero: a sell larger than the holding is a separate defect, caught by the caller
    // sizing legs from actual positions. Letting it go negative here would silently reduce the
    // portfolio total and make every band percentage wrong.
    bySecurity.set(leg.securityId, (next < 0 ? 0 : next) as Money);
  }

  const byAssetClass = new Map<AssetClass, Money>();
  for (const [securityId, value] of bySecurity) {
    const assetClass = securityById.get(securityId)?.assetClass ?? 'other';
    byAssetClass.set(assetClass, add(byAssetClass.get(assetClass) ?? ZERO, value));
  }

  const startingCash = add(...ctx.accounts.map((a) => a.cashBalance));
  const cash = add(startingCash, ...legs.map(cashDelta));
  const total = add(...[...byAssetClass.values()], cash);

  return { byAssetClass, bySecurity, cash, total };
}

/**
 * Realised gain from the sell legs, at position-average cost basis.
 *
 * Position-average, not lot-level: v1.0 populates `tax_lots` at ingest but does not yet select
 * lots, and an aggregator that cannot supply lot-level basis (amendment A1) would make a
 * lot-level figure fiction. Average basis is the conservative, honest estimate, and rule 7 is a
 * budget check rather than a tax filing.
 */
function estimateRealizedGain(legs: ProposedLeg[], ctx: GuardrailContext): Money {
  let gain = ZERO;
  for (const leg of legs) {
    if (leg.side !== 'sell') continue;
    const position = ctx.positions.find(
      (p) => p.securityId === leg.securityId && p.accountId === leg.accountId,
    );
    if (!position || position.quantity <= 0) continue;
    const account = ctx.accounts.find((a) => a.id === leg.accountId);
    // Gains inside a sheltered account are not realised for tax purposes and must not consume a
    // taxable budget.
    if (account && account.taxTreatment !== 'taxable') continue;
    const fraction = Math.min(1, leg.quantity / position.quantity);
    const basisSold = Math.round(position.costBasis * fraction) as Money;
    gain = add(gain, sub(leg.estAmount, basisSold));
  }
  return gain;
}

export { FULL_BPS, fromInput };
