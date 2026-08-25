/**
 * Allocation drift — deterministic, contract.md §1 "What the model decides".
 *
 * Nothing in this file may call a model. Drift is arithmetic over positions and the mandate's
 * bands, and it must produce the same answer every time it runs against the same inputs, because
 * a recommendation's stated `projected_drift_bps_before` is checked against it.
 */

import type { Enums } from '@/lib/db/database.types';
import { add, FULL_BPS, shareBps, ZERO, type Money } from './money';

export type AssetClass = Enums<'asset_class'>;

export interface HoldingSlice {
  assetClass: AssetClass;
  marketValue: Money;
}

export interface Band {
  assetClass: AssetClass;
  targetBps: number;
  minBps: number;
  maxBps: number;
}

export interface BandState extends Band {
  actualBps: number;
  /** signed: positive means overweight against target */
  driftBps: number;
  breached: boolean;
  marketValue: Money;
}

export interface DriftReport {
  totalMarketValue: Money;
  bands: BandState[];
  /** Largest absolute band drift. This is the household's headline number. */
  worstDriftBps: number;
  anyBreached: boolean;
}

/**
 * `breached` is band containment, not tolerance. A class outside [min,max] is a breach even when
 * its drift from target is under the tolerance, and a class inside the band is not a breach even
 * when its drift is over it. The two rules answer different questions and conflating them is how
 * a mandate stops meaning what the advisor set.
 *
 * `driftToleranceBps` decides whether drift is *material enough to act on*, which is a separate
 * judgement made by the caller.
 */
export function computeDrift(
  holdings: HoldingSlice[],
  bands: Band[],
  cash: Money = ZERO,
): DriftReport {
  const byClass = new Map<AssetClass, Money>();
  for (const h of holdings) {
    byClass.set(h.assetClass, add(byClass.get(h.assetClass) ?? ZERO, h.marketValue));
  }
  if (cash !== 0) {
    byClass.set('cash', add(byClass.get('cash') ?? ZERO, cash));
  }

  const total = add(...[...byClass.values()]);

  // Every band gets a row even when nothing is held in it: a class that has drifted to zero is
  // the most severe drift there is, and omitting the row hides it.
  const states: BandState[] = bands.map((band) => {
    const marketValue = byClass.get(band.assetClass) ?? ZERO;
    const actualBps = shareBps(marketValue, total);
    const driftBps = actualBps - band.targetBps;
    return {
      ...band,
      actualBps,
      driftBps,
      breached: actualBps < band.minBps || actualBps > band.maxBps,
      marketValue,
    };
  });

  // A class held but not present in the mandate is itself a finding, surfaced as an unbanded row
  // rather than dropped. Dropping it would make the percentages not add up, which is the kind of
  // discrepancy that destroys trust in every other number on the screen.
  //
  // Cash is the one exception, and it is not a special case so much as a different rule: the
  // mandate governs cash through `min_cash_bps` and `liquidity_need` (guardrail rule 5), not
  // through allocation bands. Mandates routinely band only the invested classes, summing to
  // 10000bps, while the household still holds cash. Flagging that as a band breach would put
  // essentially every real household permanently in breach and train advisors to ignore the
  // breach flag entirely — which is the one signal on the screen that must never become noise.
  for (const [assetClass, marketValue] of byClass) {
    if (states.some((s) => s.assetClass === assetClass)) continue;
    const actualBps = shareBps(marketValue, total);
    const governedElsewhere = assetClass === 'cash';
    states.push({
      assetClass,
      targetBps: 0,
      minBps: 0,
      maxBps: governedElsewhere ? FULL_BPS : 0,
      actualBps,
      driftBps: governedElsewhere ? 0 : actualBps,
      breached: governedElsewhere ? false : actualBps > 0,
      marketValue,
    });
  }

  const worstDriftBps = states.reduce((worst, s) => Math.max(worst, Math.abs(s.driftBps)), 0);

  return {
    totalMarketValue: total,
    bands: states,
    worstDriftBps,
    anyBreached: states.some((s) => s.breached),
  };
}

/** Publish-time rule, contract.md §3: targets must sum to exactly 10000bps. */
export function allocationSumBps(bands: Pick<Band, 'targetBps'>[]): number {
  return bands.reduce((sum, b) => sum + b.targetBps, 0);
}

export function allocationSumIsValid(bands: Pick<Band, 'targetBps'>[]): boolean {
  return allocationSumBps(bands) === FULL_BPS;
}
