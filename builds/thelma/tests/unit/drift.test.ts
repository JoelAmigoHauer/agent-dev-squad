/**
 * Contract §1 "What the model decides": drift is arithmetic, never a model, and must produce the
 * same answer every time.
 */
import { describe, expect, it } from 'vitest';
import { allocationSumIsValid, computeDrift, type Band } from '@/lib/domain/drift';
import { ZERO, fromInput } from '@/lib/domain/money';

const BANDS: Band[] = [
  { assetClass: 'us_equity', targetBps: 6000, minBps: 5500, maxBps: 6500 },
  { assetClass: 'us_bond',   targetBps: 4000, minBps: 3500, maxBps: 4500 },
];

describe('computeDrift', () => {
  it('reports zero drift when holdings match target exactly', () => {
    const report = computeDrift([
      { assetClass: 'us_equity', marketValue: fromInput(600_000) },
      { assetClass: 'us_bond',   marketValue: fromInput(400_000) },
    ], BANDS);

    expect(report.worstDriftBps).toBe(0);
    expect(report.anyBreached).toBe(false);
    expect(report.bands.find((b) => b.assetClass === 'us_equity')?.actualBps).toBe(6000);
  });

  it('signs drift so positive means overweight', () => {
    const report = computeDrift([
      { assetClass: 'us_equity', marketValue: fromInput(700_000) },
      { assetClass: 'us_bond',   marketValue: fromInput(300_000) },
    ], BANDS);

    expect(report.bands.find((b) => b.assetClass === 'us_equity')?.driftBps).toBe(1000);
    expect(report.bands.find((b) => b.assetClass === 'us_bond')?.driftBps).toBe(-1000);
  });

  it('flags a breach on band containment, not on tolerance', () => {
    // 65.00% is exactly at max and NOT breached; 65.01% is.
    const atMax = computeDrift([
      { assetClass: 'us_equity', marketValue: fromInput(650_000) },
      { assetClass: 'us_bond',   marketValue: fromInput(350_000) },
    ], BANDS);
    expect(atMax.bands.find((b) => b.assetClass === 'us_equity')?.breached).toBe(false);

    const overMax = computeDrift([
      { assetClass: 'us_equity', marketValue: fromInput(660_000) },
      { assetClass: 'us_bond',   marketValue: fromInput(340_000) },
    ], BANDS);
    expect(overMax.bands.find((b) => b.assetClass === 'us_equity')?.breached).toBe(true);
  });

  it('includes cash in the total', () => {
    const report = computeDrift([
      { assetClass: 'us_equity', marketValue: fromInput(600_000) },
      { assetClass: 'us_bond',   marketValue: fromInput(300_000) },
    ], BANDS, fromInput(100_000));

    expect(report.totalMarketValue).toBe(fromInput(1_000_000));
    expect(report.bands.find((b) => b.assetClass === 'us_equity')?.actualBps).toBe(6000);
  });

  it('emits a row for a banded class that is held at zero', () => {
    // A class drifted to nothing is the most severe drift there is. Omitting the row hides it.
    const report = computeDrift([
      { assetClass: 'us_equity', marketValue: fromInput(1_000_000) },
    ], BANDS);

    const bond = report.bands.find((b) => b.assetClass === 'us_bond');
    expect(bond).toBeDefined();
    expect(bond?.actualBps).toBe(0);
    expect(bond?.driftBps).toBe(-4000);
    expect(bond?.breached).toBe(true);
  });

  it('surfaces a held class the mandate does not band, rather than dropping it', () => {
    // Dropping it makes the percentages not add up, which destroys trust in every other number.
    const report = computeDrift([
      { assetClass: 'us_equity',   marketValue: fromInput(600_000) },
      { assetClass: 'us_bond',     marketValue: fromInput(300_000) },
      { assetClass: 'real_assets', marketValue: fromInput(100_000) },
    ], BANDS);

    const unbanded = report.bands.find((b) => b.assetClass === 'real_assets');
    expect(unbanded).toBeDefined();
    expect(unbanded?.actualBps).toBe(1000);
    expect(unbanded?.breached).toBe(true);

    const sum = report.bands.reduce((total, b) => total + b.actualBps, 0);
    expect(sum).toBe(10_000);
  });

  it('does not divide by zero on an empty portfolio', () => {
    const report = computeDrift([], BANDS, ZERO);
    expect(report.totalMarketValue).toBe(ZERO);
    expect(report.bands.every((b) => b.actualBps === 0)).toBe(true);
    expect(Number.isNaN(report.worstDriftBps)).toBe(false);
  });

  it('is deterministic across repeated runs', () => {
    const run = () => computeDrift([
      { assetClass: 'us_equity', marketValue: fromInput(712_345.67) },
      { assetClass: 'us_bond',   marketValue: fromInput(287_654.33) },
    ], BANDS);
    expect(JSON.stringify(run())).toBe(JSON.stringify(run()));
  });
});

describe('allocation sum — contract §3 publish rule', () => {
  it('accepts exactly 10000bps', () => {
    expect(allocationSumIsValid([{ targetBps: 6000 }, { targetBps: 4000 }])).toBe(true);
  });
  it('rejects 9999 and 10001', () => {
    expect(allocationSumIsValid([{ targetBps: 5999 }, { targetBps: 4000 }])).toBe(false);
    expect(allocationSumIsValid([{ targetBps: 6001 }, { targetBps: 4000 }])).toBe(false);
  });
});

describe('cash is governed by min_cash_bps, not by allocation bands — GAP 1 regression', () => {
  it('does not flag unbanded cash as a band breach', () => {
    // A mandate that bands only the invested classes to 10000bps while the household holds cash
    // is the normal case, not a breach. Flagging it put every real household permanently in
    // breach and would train advisors to ignore the one flag that must never become noise.
    const report = computeDrift([
      { assetClass: 'us_equity', marketValue: fromInput(600_000) },
      { assetClass: 'us_bond',   marketValue: fromInput(350_000) },
    ], BANDS, fromInput(50_000));

    const cash = report.bands.find((b) => b.assetClass === 'cash');
    expect(cash).toBeDefined();
    expect(cash?.actualBps).toBe(500);
    expect(cash?.breached).toBe(false);
    // Every banded class is inside its band, so cash is the only thing that could have
    // produced a breach here.
    expect(report.anyBreached).toBe(false);
  });

  it('still flags a non-cash class the mandate never authorised', () => {
    const report = computeDrift([
      { assetClass: 'us_equity',   marketValue: fromInput(600_000) },
      { assetClass: 'us_bond',     marketValue: fromInput(350_000) },
      { assetClass: 'real_assets', marketValue: fromInput(50_000) },
    ], BANDS);

    expect(report.bands.find((b) => b.assetClass === 'real_assets')?.breached).toBe(true);
    expect(report.anyBreached).toBe(true);
  });

  it('honours an explicit cash band when the mandate sets one', () => {
    const withCash = [...BANDS, { assetClass: 'cash' as const, targetBps: 0, minBps: 0, maxBps: 300 }];
    const report = computeDrift([
      { assetClass: 'us_equity', marketValue: fromInput(600_000) },
      { assetClass: 'us_bond',   marketValue: fromInput(350_000) },
    ], withCash, fromInput(50_000));

    // 5.00% against an explicit 3.00% ceiling is a breach — the exception is only for cash the
    // mandate declines to band.
    expect(report.bands.find((b) => b.assetClass === 'cash')?.breached).toBe(true);
  });
});
