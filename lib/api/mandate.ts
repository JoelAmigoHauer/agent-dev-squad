import { z } from 'zod';
import { FULL_BPS } from '@/lib/domain/money';

const assetClass = z.enum([
  'us_equity', 'intl_developed_equity', 'emerging_equity', 'us_bond', 'intl_bond',
  'real_assets', 'cash', 'other',
]);

export const allocationSchema = z.object({
  assetClass,
  targetBps: z.number().int().min(0).max(FULL_BPS),
  minBps: z.number().int().min(0).max(FULL_BPS),
  maxBps: z.number().int().min(0).max(FULL_BPS),
});

export const constraintSchema = z.object({
  kind: z.enum(['prohibited_security', 'prohibited_sector', 'concentration_cap', 'hold_minimum']),
  securityId: z.string().uuid().nullish(),
  sector: z.string().nullish(),
  limitBps: z.number().int().min(0).max(FULL_BPS).nullish(),
  note: z.string().nullish(),
});

export const autonomySchema = z.object({
  action: z.enum(['rebalance_trade', 'tax_loss_harvest', 'cash_raise', 'cash_invest', 'alert_only']),
  tier: z.enum(['observe', 'propose', 'auto_execute']),
  maxTradeAmount: z.number().positive().nullish(),
  maxDailyAmount: z.number().positive().nullish(),
});

/** Every field optional: the six-step editor sends only the step just completed (contract §3). */
export const draftSchema = z.object({
  objective: z.string().max(4000).optional(),
  riskTarget: z.number().int().min(1).max(10).optional(),
  maxDrawdownBps: z.number().int().min(0).max(FULL_BPS).nullish(),
  taxSensitivity: z.enum(['none', 'moderate', 'high']).optional(),
  realizedGainBudget: z.number().nonnegative().nullish(),
  minCashBps: z.number().int().min(0).max(FULL_BPS).optional(),
  liquidityNeed: z.number().nonnegative().optional(),
  liquidityBy: z.string().nullish(),
  rebalanceTrigger: z.enum(['band', 'calendar', 'both']).optional(),
  driftToleranceBps: z.number().int().positive().max(FULL_BPS).optional(),
  minTradeAmount: z.number().nonnegative().optional(),
  priceStalenessHours: z.number().int().positive().optional(),
  allocations: z.array(allocationSchema).optional(),
  constraints: z.array(constraintSchema).optional(),
  autonomy: z.array(autonomySchema).optional(),
});

export type DraftInput = z.infer<typeof draftSchema>;

export interface PublishViolation {
  error: string;
  field: string;
  detail?: unknown;
}

/**
 * Publish-time validation, contract §3. Every one of these is a refusal, never a correction —
 * silently normalising an advisor's mandate is how a mandate stops meaning what they set.
 *
 * Returns ALL violations rather than the first, for the same reason the guardrail engine does.
 */
export function validateForPublish(mandate: {
  allocations: { assetClass: string; targetBps: number; minBps: number; maxBps: number }[];
  autonomy: { action: string; tier: string; maxTradeAmount: number | null; maxDailyAmount: number | null }[];
  liquidityNeed: number;
}, householdMarketValue: number | null): PublishViolation[] {
  const violations: PublishViolation[] = [];

  if (mandate.allocations.length === 0) {
    violations.push({ error: 'no_allocations', field: 'allocations' });
  } else {
    const sumBps = mandate.allocations.reduce((s, a) => s + a.targetBps, 0);
    if (sumBps !== FULL_BPS) {
      violations.push({ error: 'allocation_sum', field: 'allocations', detail: { sumBps } });
    }
    for (const a of mandate.allocations) {
      if (!(a.minBps <= a.targetBps && a.targetBps <= a.maxBps)) {
        violations.push({
          error: 'band_disordered', field: 'allocations',
          detail: { assetClass: a.assetClass, minBps: a.minBps, targetBps: a.targetBps, maxBps: a.maxBps },
        });
      }
    }
  }

  for (const a of mandate.autonomy) {
    if (a.tier !== 'auto_execute') continue;
    if (!a.maxTradeAmount || a.maxTradeAmount <= 0 || !a.maxDailyAmount || a.maxDailyAmount <= 0) {
      violations.push({ error: 'unbounded_autonomy', field: 'autonomy', detail: { action: a.action } });
    }
  }

  // Checked only when holdings exist. A mandate configured before the first import is legitimate
  // and must not be blocked by a market value nobody has supplied yet.
  if (householdMarketValue !== null && mandate.liquidityNeed > householdMarketValue) {
    violations.push({
      error: 'liquidity_exceeds_portfolio', field: 'liquidityNeed',
      detail: { liquidityNeed: mandate.liquidityNeed, householdMarketValue },
    });
  }

  return violations;
}
