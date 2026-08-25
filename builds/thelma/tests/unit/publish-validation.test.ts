/**
 * Contract §3, publish-time checks. Every one is a refusal, never a correction: silently
 * normalising an advisor's mandate is how a mandate stops meaning what they set.
 */
import { describe, expect, it } from 'vitest';
import { validateForPublish } from '@/lib/api/mandate';

const OK_ALLOCATIONS = [
  { assetClass: 'us_equity', targetBps: 6000, minBps: 5000, maxBps: 7000 },
  { assetClass: 'us_bond',   targetBps: 4000, minBps: 3000, maxBps: 5000 },
];

describe('validateForPublish', () => {
  it('accepts a well-formed mandate', () => {
    expect(validateForPublish(
      { allocations: OK_ALLOCATIONS, autonomy: [], liquidityNeed: 0 }, 1_000_000)).toEqual([]);
  });

  it('refuses allocations that do not sum to exactly 10000bps', () => {
    const violations = validateForPublish({
      allocations: [{ assetClass: 'us_equity', targetBps: 5999, minBps: 5000, maxBps: 7000 },
                    { assetClass: 'us_bond',   targetBps: 4000, minBps: 3000, maxBps: 5000 }],
      autonomy: [], liquidityNeed: 0,
    }, 1_000_000);
    expect(violations[0]).toMatchObject({ error: 'allocation_sum', field: 'allocations' });
  });

  it('refuses a mandate with no allocations at all', () => {
    expect(validateForPublish({ allocations: [], autonomy: [], liquidityNeed: 0 }, null)[0])
      .toMatchObject({ error: 'no_allocations' });
  });

  it('refuses a disordered band', () => {
    const violations = validateForPublish({
      allocations: [{ assetClass: 'us_equity', targetBps: 10000, minBps: 9000, maxBps: 8000 }],
      autonomy: [], liquidityNeed: 0,
    }, null);
    expect(violations.some((v) => v.error === 'band_disordered')).toBe(true);
  });

  it('refuses an auto_execute tier with no bounds', () => {
    const violations = validateForPublish({
      allocations: OK_ALLOCATIONS,
      autonomy: [{ action: 'rebalance_trade', tier: 'auto_execute',
                   maxTradeAmount: null, maxDailyAmount: null }],
      liquidityNeed: 0,
    }, null);
    expect(violations[0]).toMatchObject({ error: 'unbounded_autonomy', field: 'autonomy' });
  });

  it('refuses an auto_execute tier with only one of the two bounds', () => {
    const violations = validateForPublish({
      allocations: OK_ALLOCATIONS,
      autonomy: [{ action: 'rebalance_trade', tier: 'auto_execute',
                   maxTradeAmount: 10_000, maxDailyAmount: null }],
      liquidityNeed: 0,
    }, null);
    expect(violations.some((v) => v.error === 'unbounded_autonomy')).toBe(true);
  });

  it('permits a propose tier with no bounds', () => {
    expect(validateForPublish({
      allocations: OK_ALLOCATIONS,
      autonomy: [{ action: 'rebalance_trade', tier: 'propose',
                   maxTradeAmount: null, maxDailyAmount: null }],
      liquidityNeed: 0,
    }, null)).toEqual([]);
  });

  it('refuses a liquidity need larger than the portfolio', () => {
    expect(validateForPublish(
      { allocations: OK_ALLOCATIONS, autonomy: [], liquidityNeed: 2_000_000 }, 1_000_000)[0])
      .toMatchObject({ error: 'liquidity_exceeds_portfolio' });
  });

  it('does NOT check liquidity before any holdings exist', () => {
    // Configuring a mandate before the first import is legitimate and must not be blocked by a
    // market value nobody has supplied yet.
    expect(validateForPublish(
      { allocations: OK_ALLOCATIONS, autonomy: [], liquidityNeed: 2_000_000 }, null)).toEqual([]);
  });

  it('returns every violation, not just the first', () => {
    const violations = validateForPublish({
      allocations: [{ assetClass: 'us_equity', targetBps: 5000, minBps: 6000, maxBps: 4000 }],
      autonomy: [{ action: 'rebalance_trade', tier: 'auto_execute',
                   maxTradeAmount: null, maxDailyAmount: null }],
      liquidityNeed: 0,
    }, null);
    expect(violations.length).toBeGreaterThanOrEqual(3);
  });
});
