/**
 * Contract §2, numeric policy. Generated from the contract, not from the implementation.
 *
 * The claim under test: money never touches float, so band arithmetic on a $5M household is
 * exact. If these fail, every figure the advisor and the examiner read is suspect.
 */
import { describe, expect, it } from 'vitest';
import {
  FULL_BPS, ZERO, add, bpsOf, fromDb, fromInput, multiplyQuantityByPrice,
  shareBps, sub, toDb,
} from '@/lib/domain/money';

describe('money — integer minor units', () => {
  it('round-trips a value through the database representation', () => {
    expect(toDb(fromDb(1234.5678))).toBe(1234.5678);
  });

  it('sums values that float would get wrong', () => {
    // 0.1 + 0.2 !== 0.3 in float64. It must be exact here.
    const total = add(fromInput(0.1), fromInput(0.2));
    expect(toDb(total)).toBe(0.3);
  });

  it('sums a large book without drift', () => {
    const values = Array.from({ length: 1000 }, () => fromInput(4_999.99));
    expect(toDb(add(...values))).toBe(4_999_990);
  });

  it('refuses a sum beyond safe integer range rather than silently losing precision', () => {
    const huge = fromInput(9_000_000_000);
    expect(() => add(...Array.from({ length: 200 }, () => huge))).toThrow(RangeError);
  });

  it('rejects non-finite input', () => {
    expect(() => fromInput(Number.NaN)).toThrow(RangeError);
    expect(() => fromDb('not a number')).toThrow(RangeError);
  });

  it('treats null and undefined from the database as zero', () => {
    expect(fromDb(null)).toBe(ZERO);
    expect(fromDb(undefined)).toBe(ZERO);
  });

  it('subtracts', () => {
    expect(toDb(sub(fromInput(100), fromInput(30.25)))).toBe(69.75);
  });

  it('multiplies quantity by price at the money scale', () => {
    expect(toDb(multiplyQuantityByPrice(3.5, 289.42))).toBe(1012.97);
  });
});

describe('basis points — integers throughout', () => {
  it('computes a share in bps', () => {
    expect(shareBps(fromInput(2_500), fromInput(10_000))).toBe(2500);
  });

  it('returns 0 rather than NaN for an empty portfolio', () => {
    // A NaN propagating into a band comparison makes every rule pass silently.
    expect(shareBps(fromInput(100), ZERO)).toBe(0);
  });

  it('takes a bps slice of a total', () => {
    expect(toDb(bpsOf(fromInput(10_000), 250))).toBe(250);
  });

  it('rounds half-up rather than truncating', () => {
    expect(shareBps(fromInput(1), fromInput(3))).toBe(3333);
  });

  it('FULL_BPS is 10000', () => {
    expect(FULL_BPS).toBe(10_000);
  });
});
