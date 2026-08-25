/**
 * Market data — amendment A2: polled snapshots, no streaming subscription.
 *
 * A2 settled this: a streaming feed would be a resident process holding a connection between
 * requests, which fires escalation trigger 2 and adds exchange redistribution licensing. Polled
 * snapshots satisfy the brief's own metric ("minutes, not hours") and need nothing added to the
 * stack.
 */

export interface PriceQuote {
  symbol: string;
  closePrice: number;
  priceDate: string;
  source: string;
}

export interface MarketDataAdapter {
  readonly id: string;
  fetchPrices(symbols: string[], asOf?: Date): Promise<PriceQuote[]>;
}

import { SIMULATED_AS_OF, SIMULATED_PRICES } from './simulated';

export const simulatedMarketData: MarketDataAdapter = {
  id: 'simulated',
  async fetchPrices(symbols: string[]): Promise<PriceQuote[]> {
    const priceDate = SIMULATED_AS_OF.slice(0, 10);
    return symbols
      .filter((s) => s in SIMULATED_PRICES)
      .map((symbol) => ({
        symbol,
        closePrice: SIMULATED_PRICES[symbol]!,
        priceDate,
        source: 'simulated',
      }));
  },
};

/** Hours between `asOf` and now. The staleness gate in contract §1 F3 reads this. */
export function hoursSince(asOf: string | Date, now: Date = new Date()): number {
  const then = typeof asOf === 'string' ? new Date(asOf) : asOf;
  return (now.getTime() - then.getTime()) / 3_600_000;
}

export function isStale(asOf: string | Date, toleranceHours: number, now: Date = new Date()): boolean {
  return hoursSince(asOf, now) > toleranceHours;
}
