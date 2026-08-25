/**
 * Deterministic proposal engine.
 *
 * Two jobs, both real:
 *   1. QA drives this one. Assertions about drift figures and guardrail outcomes need identical
 *      results on every run; an LLM in that path makes the guardrail tests flaky in a way that
 *      looks exactly like a guardrail bug.
 *   2. It runs in production whenever no ANTHROPIC_API_KEY is configured. A monitoring cycle that
 *      cannot reason still detects drift and still proposes the arithmetic fix — it just writes a
 *      plainer rationale. Degrading to "no recommendations" would be worse: the advisor would
 *      read an in-mandate portfolio where there is a breach.
 *
 * It proposes the obvious trade: sell the most overweight class down toward target, buy the most
 * underweight up. No cleverness — cleverness is the LLM's job.
 */

import { ZERO, add, bpsOf, sub, type Money } from '@/lib/domain/money';
import { formatBps } from '@/lib/domain/money';
import type { ProposedLeg } from '@/lib/guardrails/types';
import type { Candidate, ProposalEngine, ProposalInput } from './types';

export const deterministicProposalEngine: ProposalEngine = {
  id: 'deterministic',
  model: null,

  async propose(input: ProposalInput) {
    const { drift, ctx, symbolsById, pricesBySecurityId } = input;

    const over = drift.bands
      .filter((b) => b.driftBps > 0 && Math.abs(b.driftBps) >= ctx.mandate.driftToleranceBps)
      .sort((a, b) => b.driftBps - a.driftBps);
    const under = drift.bands
      .filter((b) => b.driftBps < 0 && Math.abs(b.driftBps) >= ctx.mandate.driftToleranceBps)
      .sort((a, b) => a.driftBps - b.driftBps);

    if (over.length === 0 || under.length === 0) return { candidates: [] };

    const sellBand = over[0]!;
    const buyBand = under[0]!;

    // Move the smaller of the two gaps, so neither side overshoots its target.
    const sellGap = bpsOf(drift.totalMarketValue, sellBand.driftBps);
    const buyGap = bpsOf(drift.totalMarketValue, Math.abs(buyBand.driftBps));
    const tradeAmount = (sellGap < buyGap ? sellGap : buyGap) as Money;
    if (tradeAmount < ctx.mandate.minTradeAmount) return { candidates: [] };

    const sellLeg = buildLeg('sell', sellBand.assetClass, tradeAmount, input);
    const buyLeg = buildLeg('buy', buyBand.assetClass, tradeAmount, input);
    if (!sellLeg || !buyLeg) return { candidates: [] };

    const sellSymbol = symbolsById.get(sellLeg.securityId) ?? 'the overweight holding';
    const buySymbol = symbolsById.get(buyLeg.securityId) ?? 'the underweight holding';

    const rationale =
      `${sellBand.assetClass.replace(/_/g, ' ')} sits at ${formatBps(sellBand.actualBps)} ` +
      `against a ${formatBps(sellBand.targetBps)} target ` +
      `(band ${formatBps(sellBand.minBps)}–${formatBps(sellBand.maxBps)}), ` +
      `while ${buyBand.assetClass.replace(/_/g, ' ')} sits at ${formatBps(buyBand.actualBps)} ` +
      `against ${formatBps(buyBand.targetBps)}. Both exceed the mandate's ` +
      `${formatBps(ctx.mandate.driftToleranceBps)} drift tolerance. ` +
      `Selling ${sellSymbol} and buying ${buySymbol} in equal dollar amount closes the smaller of ` +
      `the two gaps without pushing either class past its target. ` +
      `Prices are the latest close held for each security; quantities are indicative and will be ` +
      `re-priced at execution.`;

    void pricesBySecurityId;

    return {
      candidates: [{
        action: 'rebalance_trade',
        legs: [sellLeg, buyLeg],
        rationale,
        projectedRealizedGain: ZERO,
        projectedTaxCost: ZERO,
      } satisfies Candidate],
    };
  },
};

/**
 * Picks the largest position in the class and sizes a leg against it.
 *
 * A sell is capped at the position actually held — proposing to sell more than exists is not a
 * ranking mistake, it is an impossible trade, and the guardrail engine would clamp it silently
 * rather than reject it.
 */
function buildLeg(
  side: 'buy' | 'sell',
  assetClass: string,
  amount: Money,
  input: ProposalInput,
): ProposedLeg | null {
  const { ctx, pricesBySecurityId } = input;
  const inClass = ctx.securities.filter((s) => s.assetClass === assetClass);
  if (inClass.length === 0) return null;

  let best: { securityId: string; accountId: string; marketValue: Money } | null = null;
  for (const security of inClass) {
    for (const position of ctx.positions) {
      if (position.securityId !== security.id) continue;
      if (!best || position.marketValue > best.marketValue) {
        best = {
          securityId: security.id,
          accountId: position.accountId,
          marketValue: position.marketValue,
        };
      }
    }
  }

  // Nothing held in the class yet: buy into it via the first taxable account we have.
  if (!best) {
    if (side === 'sell') return null;
    const account = ctx.accounts.find((a) => a.taxTreatment === 'taxable') ?? ctx.accounts[0];
    const security = inClass[0];
    if (!account || !security) return null;
    best = { securityId: security.id, accountId: account.id, marketValue: ZERO };
  }

  const price = pricesBySecurityId.get(best.securityId);
  if (!price || price <= 0) return null;

  const capped = (side === 'sell' && amount > best.marketValue ? best.marketValue : amount) as Money;
  if (capped <= 0) return null;

  const quantity = Number((capped / 10_000 / price).toFixed(6));
  if (quantity <= 0) return null;

  return {
    accountId: best.accountId,
    securityId: best.securityId,
    side,
    quantity,
    estPrice: price,
    estAmount: capped,
  };
}

export { add, sub };
