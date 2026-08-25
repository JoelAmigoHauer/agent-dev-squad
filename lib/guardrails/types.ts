import type { Enums } from '@/lib/db/database.types';
import type { Money } from '@/lib/domain/money';
import type { AssetClass, Band } from '@/lib/domain/drift';

export interface ProposedLeg {
  accountId: string;
  securityId: string;
  side: 'buy' | 'sell';
  quantity: number;
  estPrice: number;
  /** derived, not trusted from the caller */
  estAmount: Money;
}

export interface AccountFacts {
  id: string;
  taxTreatment: Enums<'account_tax_treatment'>;
  cashBalance: Money;
}

export interface SecurityFacts {
  id: string;
  symbol: string;
  assetClass: AssetClass;
  sector: string | null;
}

export interface PositionFacts {
  accountId: string;
  securityId: string;
  quantity: number;
  marketValue: Money;
  costBasis: Money;
}

export interface MandateFacts {
  id: string;
  version: number;
  bands: Band[];
  minCashBps: number;
  liquidityNeed: Money;
  minTradeAmount: Money;
  realizedGainBudget: Money | null;
  driftToleranceBps: number;
  constraints: {
    kind: Enums<'constraint_kind'>;
    securityId: string | null;
    sector: string | null;
    limitBps: number | null;
  }[];
  autonomy: {
    action: Enums<'action_type'>;
    tier: Enums<'autonomy_tier'>;
    maxTradeAmount: Money | null;
    maxDailyAmount: Money | null;
  }[];
}

export interface GuardrailContext {
  action: Enums<'action_type'>;
  mandate: MandateFacts;
  accounts: AccountFacts[];
  securities: SecurityFacts[];
  positions: PositionFacts[];
  /** realised gains already booked this calendar year, from `transactions` */
  realizedGainYtd: Money;
  /** total already auto-executed today for this action, for rule 10 */
  autoExecutedTodayAmount: Money;
  shadowMode: boolean;
  /** true only when the caller is actually attempting to execute, not merely propose */
  isExecutionAttempt: boolean;
}

export interface RuleOutcome {
  rule: number;
  name: string;
  pass: boolean;
  detail?: unknown;
}

export interface GuardrailResult {
  pass: boolean;
  /** Every rule, passes included. See the note in engine.ts on why. */
  rulesEvaluated: RuleOutcome[];
  breaches: RuleOutcome[];
}
