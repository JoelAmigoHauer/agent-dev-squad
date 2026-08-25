/**
 * Contract §3, the guardrail engine. The central safety claim of the whole product:
 * "probabilistic reasoning bounded by deterministic guardrails".
 *
 * Two properties are asserted alongside the individual rules, and they matter as much:
 *   - ALL eleven rules are always evaluated, passes included. A result carrying only failures
 *     cannot distinguish "rule 7 checked and fine" from "rule 7 never ran".
 *   - It never short-circuits on the first breach.
 */
import { describe, expect, it } from 'vitest';
import { evaluateGuardrails } from '@/lib/guardrails/engine';
import type { GuardrailContext, ProposedLeg } from '@/lib/guardrails/types';
import { fromInput, multiplyQuantityByPrice, ZERO } from '@/lib/domain/money';

const TAXABLE = 'acc-taxable';
const IRA = 'acc-ira';
const EQ = 'sec-equity';
const BOND = 'sec-bond';
const OIL = 'sec-oil';

function ctx(overrides: Partial<GuardrailContext> = {}): GuardrailContext {
  return {
    action: 'rebalance_trade',
    mandate: {
      id: 'm1', version: 1,
      bands: [
        { assetClass: 'us_equity', targetBps: 6000, minBps: 5000, maxBps: 7000 },
        { assetClass: 'us_bond',   targetBps: 4000, minBps: 3000, maxBps: 5000 },
      ],
      minCashBps: 0,
      liquidityNeed: ZERO,
      minTradeAmount: fromInput(1_000),
      realizedGainBudget: null,
      driftToleranceBps: 500,
      constraints: [],
      autonomy: [{ action: 'rebalance_trade', tier: 'propose', maxTradeAmount: null, maxDailyAmount: null }],
      ...overrides.mandate,
    },
    accounts: overrides.accounts ?? [
      { id: TAXABLE, taxTreatment: 'taxable', cashBalance: fromInput(50_000) },
      { id: IRA, taxTreatment: 'traditional_ira', cashBalance: fromInput(10_000) },
    ],
    securities: overrides.securities ?? [
      { id: EQ,   symbol: 'VTI', assetClass: 'us_equity', sector: 'Diversified' },
      { id: BOND, symbol: 'BND', assetClass: 'us_bond',   sector: 'Diversified' },
      { id: OIL,  symbol: 'XOM', assetClass: 'us_equity', sector: 'Energy' },
    ],
    positions: overrides.positions ?? [
      { accountId: TAXABLE, securityId: EQ,   quantity: 1000, marketValue: fromInput(600_000), costBasis: fromInput(400_000) },
      { accountId: TAXABLE, securityId: BOND, quantity: 1000, marketValue: fromInput(340_000), costBasis: fromInput(350_000) },
    ],
    realizedGainYtd: overrides.realizedGainYtd ?? ZERO,
    autoExecutedTodayAmount: overrides.autoExecutedTodayAmount ?? ZERO,
    shadowMode: overrides.shadowMode ?? false,
    isExecutionAttempt: overrides.isExecutionAttempt ?? false,
    ...('action' in overrides ? { action: overrides.action! } : {}),
  };
}

function leg(p: Partial<ProposedLeg> & { side: 'buy' | 'sell'; securityId: string }): ProposedLeg {
  const quantity = p.quantity ?? 10;
  const estPrice = p.estPrice ?? 300;
  return {
    accountId: p.accountId ?? TAXABLE,
    securityId: p.securityId,
    side: p.side,
    quantity,
    estPrice,
    estAmount: p.estAmount ?? multiplyQuantityByPrice(quantity, estPrice),
  };
}

describe('the two structural properties', () => {
  it('always evaluates all 11 rules, even on a clean pass', () => {
    const result = evaluateGuardrails([leg({ side: 'sell', securityId: EQ, quantity: 50 })], ctx());
    expect(result.rulesEvaluated).toHaveLength(11);
    expect(result.rulesEvaluated.map((r) => r.rule)).toEqual([1,2,3,4,5,6,7,8,9,10,11]);
  });

  it('reports every breach rather than stopping at the first', () => {
    const result = evaluateGuardrails(
      [leg({ side: 'buy', securityId: OIL, quantity: 1, estPrice: 100 })],
      ctx({
        mandate: {
          ...ctx().mandate,
          constraints: [
            { kind: 'prohibited_security', securityId: OIL, sector: null, limitBps: null },
            { kind: 'prohibited_sector', securityId: null, sector: 'Energy', limitBps: null },
          ],
        },
      }),
    );
    // rule 1 (prohibited security), rule 2 (prohibited sector) and rule 9 (below min trade)
    // must all appear — not just the first.
    const breached = result.breaches.map((b) => b.rule);
    expect(breached).toContain(1);
    expect(breached).toContain(2);
    expect(breached).toContain(9);
    expect(result.rulesEvaluated).toHaveLength(11);
  });

  it('still records passing rules with their outcome', () => {
    const result = evaluateGuardrails([leg({ side: 'sell', securityId: EQ, quantity: 50 })], ctx());
    const rule7 = result.rulesEvaluated.find((r) => r.rule === 7);
    expect(rule7?.pass).toBe(true);
    expect(rule7?.name).toContain('realised gains');
  });
});

describe('rule 1 — prohibited security', () => {
  const prohibited = ctx({
    mandate: { ...ctx().mandate,
      constraints: [{ kind: 'prohibited_security', securityId: OIL, sector: null, limitBps: null }] },
  });

  it('refuses a buy of a prohibited security', () => {
    const result = evaluateGuardrails([leg({ side: 'buy', securityId: OIL, quantity: 100 })], prohibited);
    expect(result.rulesEvaluated.find((r) => r.rule === 1)?.pass).toBe(false);
  });

  it('permits SELLING a prohibited security — that is how you exit one', () => {
    const result = evaluateGuardrails([leg({ side: 'sell', securityId: OIL, quantity: 10 })], prohibited);
    expect(result.rulesEvaluated.find((r) => r.rule === 1)?.pass).toBe(true);
  });
});

describe('rule 2 — prohibited sector', () => {
  it('refuses a buy into a prohibited sector, case-insensitively', () => {
    const result = evaluateGuardrails([leg({ side: 'buy', securityId: OIL, quantity: 100 })], ctx({
      mandate: { ...ctx().mandate,
        constraints: [{ kind: 'prohibited_sector', securityId: null, sector: 'energy', limitBps: null }] },
    }));
    expect(result.rulesEvaluated.find((r) => r.rule === 2)?.pass).toBe(false);
  });
});

describe('rule 3 — post-trade band containment', () => {
  it('refuses a trade that pushes a class outside its band', () => {
    // Buying 500k more equity takes us_equity from 60% to well over the 70% ceiling.
    const result = evaluateGuardrails(
      [leg({ side: 'buy', securityId: EQ, quantity: 2000, estPrice: 300 })], ctx());
    expect(result.rulesEvaluated.find((r) => r.rule === 3)?.pass).toBe(false);
  });

  it('permits a trade that moves toward target', () => {
    const result = evaluateGuardrails(
      [leg({ side: 'sell', securityId: EQ, quantity: 100, estPrice: 300 }),
       leg({ side: 'buy',  securityId: BOND, quantity: 100, estPrice: 300 })], ctx());
    expect(result.rulesEvaluated.find((r) => r.rule === 3)?.pass).toBe(true);
  });
});

describe('rule 4 — concentration cap', () => {
  it('refuses a position above a portfolio-wide cap', () => {
    const result = evaluateGuardrails([leg({ side: 'buy', securityId: EQ, quantity: 1, estPrice: 300 })], ctx({
      mandate: { ...ctx().mandate,
        constraints: [{ kind: 'concentration_cap', securityId: null, sector: null, limitBps: 5000 }] },
    }));
    // us_equity is already ~60% of the book, above a 50% cap.
    expect(result.rulesEvaluated.find((r) => r.rule === 4)?.pass).toBe(false);
  });
});

describe('rule 5 — cash floor and liquidity', () => {
  it('refuses a buy that takes cash below the minimum', () => {
    const result = evaluateGuardrails(
      [leg({ side: 'buy', securityId: BOND, quantity: 200, estPrice: 300 })],
      ctx({ mandate: { ...ctx().mandate, minCashBps: 500 } }),
    );
    expect(result.rulesEvaluated.find((r) => r.rule === 5)?.pass).toBe(false);
  });

  it('counts a stated liquidity need on top of the floor', () => {
    const result = evaluateGuardrails(
      [leg({ side: 'buy', securityId: BOND, quantity: 100, estPrice: 300 })],
      ctx({ mandate: { ...ctx().mandate, minCashBps: 0, liquidityNeed: fromInput(45_000) } }),
    );
    expect(result.rulesEvaluated.find((r) => r.rule === 5)?.pass).toBe(false);
  });
});

describe('rule 6 — hold minimum', () => {
  it('refuses selling a position below its floor', () => {
    const result = evaluateGuardrails(
      [leg({ side: 'sell', securityId: EQ, quantity: 1900, estPrice: 300 })],
      ctx({ mandate: { ...ctx().mandate,
        constraints: [{ kind: 'hold_minimum', securityId: EQ, sector: null, limitBps: 5000 }] } }),
    );
    expect(result.rulesEvaluated.find((r) => r.rule === 6)?.pass).toBe(false);
  });
});

describe('rule 7 — realised gain budget', () => {
  it('passes when no budget is set, and says so', () => {
    const result = evaluateGuardrails([leg({ side: 'sell', securityId: EQ, quantity: 500 })], ctx());
    const rule = result.rulesEvaluated.find((r) => r.rule === 7);
    expect(rule?.pass).toBe(true);
    expect(rule?.detail).toEqual({ budget: null });
  });

  it('refuses a sale that would exceed the annual budget', () => {
    const result = evaluateGuardrails(
      [leg({ side: 'sell', securityId: EQ, quantity: 500, estPrice: 600 })],
      ctx({ mandate: { ...ctx().mandate, realizedGainBudget: fromInput(1_000) } }),
    );
    expect(result.rulesEvaluated.find((r) => r.rule === 7)?.pass).toBe(false);
  });

  it('does NOT count gains inside a sheltered account against a taxable budget', () => {
    const result = evaluateGuardrails(
      [leg({ side: 'sell', accountId: IRA, securityId: EQ, quantity: 500, estPrice: 600 })],
      ctx({
        mandate: { ...ctx().mandate, realizedGainBudget: fromInput(1_000) },
        positions: [
          { accountId: IRA, securityId: EQ, quantity: 1000, marketValue: fromInput(600_000), costBasis: fromInput(100_000) },
          { accountId: TAXABLE, securityId: BOND, quantity: 1000, marketValue: fromInput(340_000), costBasis: fromInput(350_000) },
        ],
      }),
    );
    expect(result.rulesEvaluated.find((r) => r.rule === 7)?.pass).toBe(true);
  });
});

describe('rule 8 — no harvesting in a sheltered account', () => {
  it('refuses a tax_loss_harvest leg in an IRA', () => {
    // A loss inside an IRA is not deductible: the trade achieves nothing and costs something.
    const result = evaluateGuardrails(
      [leg({ side: 'sell', accountId: IRA, securityId: EQ, quantity: 10 })],
      ctx({ action: 'tax_loss_harvest' }),
    );
    expect(result.rulesEvaluated.find((r) => r.rule === 8)?.pass).toBe(false);
  });

  it('permits a tax_loss_harvest leg in a taxable account', () => {
    const result = evaluateGuardrails(
      [leg({ side: 'sell', accountId: TAXABLE, securityId: BOND, quantity: 10 })],
      ctx({ action: 'tax_loss_harvest' }),
    );
    expect(result.rulesEvaluated.find((r) => r.rule === 8)?.pass).toBe(true);
  });

  it('does not apply the rule to a plain rebalance in an IRA', () => {
    const result = evaluateGuardrails(
      [leg({ side: 'sell', accountId: IRA, securityId: EQ, quantity: 10 })], ctx());
    expect(result.rulesEvaluated.find((r) => r.rule === 8)?.pass).toBe(true);
  });
});

describe('rule 9 — minimum trade amount', () => {
  it('refuses a leg below the minimum', () => {
    const result = evaluateGuardrails(
      [leg({ side: 'sell', securityId: EQ, quantity: 1, estPrice: 100 })], ctx());
    expect(result.rulesEvaluated.find((r) => r.rule === 9)?.pass).toBe(false);
  });
});

describe('rule 10 — auto-execute bounds', () => {
  const autoCtx = (overrides: Partial<GuardrailContext> = {}) => ctx({
    ...overrides,
    isExecutionAttempt: true,
    mandate: {
      ...ctx().mandate,
      autonomy: [{ action: 'rebalance_trade', tier: 'auto_execute',
                   maxTradeAmount: fromInput(10_000), maxDailyAmount: fromInput(25_000) }],
      ...overrides.mandate,
    },
  });

  it('refuses a leg above the per-trade bound', () => {
    const result = evaluateGuardrails(
      [leg({ side: 'sell', securityId: EQ, quantity: 100, estPrice: 300 })], autoCtx());
    expect(result.rulesEvaluated.find((r) => r.rule === 10)?.pass).toBe(false);
  });

  it('refuses when the daily total would be exceeded', () => {
    const result = evaluateGuardrails(
      [leg({ side: 'sell', securityId: EQ, quantity: 20, estPrice: 300 })],
      autoCtx({ autoExecutedTodayAmount: fromInput(24_000) }),
    );
    expect(result.rulesEvaluated.find((r) => r.rule === 10)?.pass).toBe(false);
  });

  it('passes and records the tier when this is only a proposal', () => {
    const result = evaluateGuardrails(
      [leg({ side: 'sell', securityId: EQ, quantity: 100, estPrice: 300 })], ctx());
    const rule = result.rulesEvaluated.find((r) => r.rule === 10);
    expect(rule?.pass).toBe(true);
    expect(rule?.detail).toMatchObject({ executionAttempt: false });
  });
});

describe('rule 11 — shadow mode', () => {
  it('blocks an execution attempt while shadow mode is on', () => {
    const result = evaluateGuardrails(
      [leg({ side: 'sell', securityId: EQ, quantity: 50 })],
      ctx({ shadowMode: true, isExecutionAttempt: true }),
    );
    expect(result.rulesEvaluated.find((r) => r.rule === 11)?.pass).toBe(false);
    expect(result.pass).toBe(false);
  });

  it('does NOT block merely proposing while shadow mode is on', () => {
    // Shadow mode's whole purpose is safe testing on live data: proposals must still be produced.
    const result = evaluateGuardrails(
      [leg({ side: 'sell', securityId: EQ, quantity: 50 })],
      ctx({ shadowMode: true, isExecutionAttempt: false }),
    );
    expect(result.rulesEvaluated.find((r) => r.rule === 11)?.pass).toBe(true);
  });
});
