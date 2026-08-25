import type { Enums } from '@/lib/db/database.types';
import type { Money } from '@/lib/domain/money';
import type { DriftReport } from '@/lib/domain/drift';
import type { GuardrailContext, ProposedLeg } from '@/lib/guardrails/types';

export interface Candidate {
  action: Enums<'action_type'>;
  legs: ProposedLeg[];
  rationale: string;
  projectedRealizedGain: Money;
  projectedTaxCost: Money;
}

export interface ProposalInput {
  householdName: string;
  drift: DriftReport;
  observations: {
    kind: Enums<'observation_kind'>;
    severity: Enums<'severity'>;
    assetClass: Enums<'asset_class'> | null;
    detail: Record<string, unknown>;
  }[];
  ctx: GuardrailContext;
  symbolsById: Map<string, string>;
  pricesBySecurityId: Map<string, number>;
}

export interface ProposalEngine {
  readonly id: string;
  readonly model: string | null;
  propose(input: ProposalInput): Promise<{
    candidates: Candidate[];
    tokensIn?: number;
    tokensOut?: number;
  }>;
}
