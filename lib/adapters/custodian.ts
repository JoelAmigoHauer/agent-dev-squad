/**
 * The custodian port — contract.md §3, amendment A1.
 *
 * This seam exists because the brief names Schwab, Fidelity and Pershing for holdings,
 * transactions AND order routing, and those APIs are gated on firm-level credentials that a build
 * cannot obtain. Joel's call (A1) was to ingest through an aggregator instead. The port is what
 * makes that a change of implementation rather than a change of architecture.
 *
 * `placeOrders` is deliberately ABSENT from the interface rather than present and throwing. A
 * method that exists and throws is a method callers write against, and the first thing anyone
 * would write against it is an execution path. v1.0 has no execution path by construction.
 */

import type { Enums } from '@/lib/db/database.types';

export type CustodianId = 'csv' | 'simulated' | 'byallaccounts' | 'schwab' | 'fidelity' | 'pershing';

export interface CustodianCapabilities {
  holdings: boolean;
  transactions: boolean;
  taxLots: boolean;
  /**
   * Whether the vendor supplies cost basis per tax lot rather than per position. The tax agent
   * reads this and degrades to position-average basis when false — it must never fabricate lots.
   */
  lotLevelBasis: boolean;
  /** false for every v1.0 adapter. The review workflow reads it, so the release path is inert
   *  because no adapter claims the capability — not because a flag happens to be off. */
  orderRouting: boolean;
}

export interface FirmContext {
  firmId: string;
  householdId: string;
}

export interface SnapshotAccount {
  custodianAccountId: string;
  displayName: string;
  taxTreatment: Enums<'account_tax_treatment'>;
  cashBalance: number;
}

export interface SnapshotPosition {
  custodianAccountId: string;
  symbol: string;
  cusip?: string;
  quantity: number;
  marketValue: number;
  costBasis: number;
}

export interface SnapshotTaxLot {
  custodianAccountId: string;
  symbol: string;
  custodianLotId?: string;
  openDate: string;
  quantity: number;
  costBasis: number;
}

export interface SnapshotTransaction {
  custodianAccountId: string;
  symbol?: string;
  type: Enums<'transaction_type'>;
  tradeDate: string;
  settleDate?: string;
  quantity?: number;
  price?: number;
  amount: number;
  custodianTxnId?: string;
}

export interface CustodianSnapshot {
  asOf: string;
  accounts: SnapshotAccount[];
  positions: SnapshotPosition[];
  taxLots: SnapshotTaxLot[];
  transactions: SnapshotTransaction[];
}

export interface CustodianAdapter {
  readonly id: CustodianId;
  readonly capabilities: CustodianCapabilities;
  fetchSnapshot(ctx: FirmContext, payload?: unknown): Promise<CustodianSnapshot>;
}

export class VendorUnavailableError extends Error {
  constructor(readonly vendor: CustodianId, readonly upstreamStatus?: number) {
    super(`custodian vendor unavailable: ${vendor}`);
    this.name = 'VendorUnavailableError';
  }
}

export class NotConnectedError extends Error {
  constructor(readonly vendor: CustodianId, readonly status: string) {
    super(`custodian not connected: ${vendor} (${status})`);
    this.name = 'NotConnectedError';
  }
}
