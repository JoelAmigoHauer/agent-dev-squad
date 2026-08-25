/**
 * Numeric policy — contract.md §2.
 *
 * Money is numeric(20,4) in the database. PostgREST hands it back as a JSON number, which is a
 * float64, and float64 cannot represent 0.1. Summing a few hundred position market values in
 * float and comparing the result against a band produces answers that are wrong in the last
 * places — on a system whose output an examiner reads, that is not acceptable.
 *
 * So: money crosses the boundary as a number and is immediately scaled to an integer number of
 * ten-thousandths. All arithmetic is integer. It converts back only to render or to persist.
 *
 * 20 digits with scale 4 means values up to 10^16 in minor units, comfortably inside
 * Number.MAX_SAFE_INTEGER (~9.007 x 10^15) for any realistic household — but a firm-level sum
 * across a very large book could approach it, so `add` checks.
 */

export const MONEY_SCALE = 10_000;

/** Integer ten-thousandths of a dollar. Never construct one by hand — use fromDb or fromInput. */
export type Money = number & { readonly __brand: 'Money' };

export function fromDb(value: number | string | null | undefined): Money {
  if (value === null || value === undefined) return 0 as Money;
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n)) throw new RangeError(`money: not finite: ${String(value)}`);
  return Math.round(n * MONEY_SCALE) as Money;
}

export function toDb(m: Money): number {
  return m / MONEY_SCALE;
}

export function fromInput(dollars: number): Money {
  if (!Number.isFinite(dollars)) throw new RangeError('money: not finite');
  return Math.round(dollars * MONEY_SCALE) as Money;
}

export const ZERO = 0 as Money;

export function add(...values: Money[]): Money {
  let total = 0;
  for (const v of values) {
    total += v;
    if (!Number.isSafeInteger(total)) {
      throw new RangeError('money: sum exceeds safe integer range');
    }
  }
  return total as Money;
}

export function sub(a: Money, b: Money): Money {
  return (a - b) as Money;
}

export function neg(a: Money): Money {
  return -a as Money;
}

export function abs(a: Money): Money {
  return Math.abs(a) as Money;
}

export function isZero(a: Money): boolean {
  return a === 0;
}

/** quantity is numeric(20,6); price is numeric(20,4). Rounds half-up to the money scale. */
export function multiplyQuantityByPrice(quantity: number, price: number): Money {
  return Math.round(quantity * price * MONEY_SCALE) as Money;
}

export function format(m: Money): string {
  return (m / MONEY_SCALE).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ---------------------------------------------------------------------------
// Basis points. Integers throughout — 10000 bps = 100.00%.
// ---------------------------------------------------------------------------

export const FULL_BPS = 10_000;

/**
 * `part` as a share of `total`, in basis points, rounded half-up.
 * A zero total yields 0 rather than NaN: an empty portfolio is 0% of everything, and a NaN
 * propagating into a band comparison silently makes every rule pass.
 */
export function shareBps(part: Money, total: Money): number {
  if (total === 0) return 0;
  return Math.round((part / total) * FULL_BPS);
}

export function bpsOf(total: Money, bps: number): Money {
  return Math.round((total * bps) / FULL_BPS) as Money;
}

export function formatBps(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}
