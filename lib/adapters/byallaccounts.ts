/**
 * ByAllAccounts (Morningstar) adapter — amendment A1.
 *
 * ============================ READ THIS BEFORE TRUSTING IT ============================
 * UNEXERCISED. Written against the documented API shape and never run against a live vendor,
 * because no ByAllAccounts credential exists in this environment and obtaining one is a
 * Morningstar sales motion, not an engineering task.
 *
 * It is NOT to be described as working. `build-notes.md` says the same thing, and the connection
 * row for this vendor stays `pending` until someone has actually authenticated it.
 * =====================================================================================
 *
 * Why this vendor and not Plaid or Yodlee (A1): both of those consent through an end-user Link
 * flow, and v1 has no client-facing surface for a client to complete one. Both also expose cost
 * basis per position rather than per lot, which would defeat the reason `tax_lots` exists.
 */

import {
  NotConnectedError, VendorUnavailableError,
  type CustodianAdapter, type CustodianSnapshot, type FirmContext,
} from './custodian';

interface BaaConfig {
  baseUrl: string;
  apiKey: string;
  /** BAA's per-firm data-gathering identifier, stored as aggregator_connections.external_id */
  firmExternalId: string;
}

function readConfig(externalId: string | null): BaaConfig {
  const baseUrl = process.env.BAA_BASE_URL;
  const apiKey = process.env.BAA_API_KEY;
  if (!baseUrl || !apiKey || !externalId) {
    throw new NotConnectedError('byallaccounts', 'pending');
  }
  return { baseUrl, apiKey, firmExternalId: externalId };
}

export function createByAllAccountsAdapter(externalId: string | null): CustodianAdapter {
  return {
    id: 'byallaccounts',
    capabilities: {
      holdings: true, transactions: true, taxLots: true,
      lotLevelBasis: true, orderRouting: false,
    },
    async fetchSnapshot(ctx: FirmContext): Promise<CustodianSnapshot> {
      const config = readConfig(externalId);
      const url = new URL('/v1/accounts/holdings', config.baseUrl);
      url.searchParams.set('firmId', config.firmExternalId);
      url.searchParams.set('householdId', ctx.householdId);

      const response = await fetch(url, {
        headers: {
          authorization: `Bearer ${config.apiKey}`,
          accept: 'application/json',
        },
        // Bounded so a hung vendor cannot hold a function open to its 300s ceiling.
        signal: AbortSignal.timeout(30_000),
      });

      if (response.status === 401 || response.status === 403) {
        throw new NotConnectedError('byallaccounts', 'revoked');
      }
      if (!response.ok) {
        throw new VendorUnavailableError('byallaccounts', response.status);
      }

      const body = (await response.json()) as unknown;
      return normalise(body);
    },
  };
}

/**
 * Kept separate from the fetch so it is unit-testable against a captured payload without a live
 * credential — which is the only way any part of this adapter can be verified today.
 */
export function normalise(body: unknown): CustodianSnapshot {
  const root = body as {
    asOf?: string;
    accounts?: unknown[];
    positions?: unknown[];
    taxLots?: unknown[];
    transactions?: unknown[];
  };
  return {
    asOf: root.asOf ?? new Date().toISOString(),
    accounts: (root.accounts ?? []) as CustodianSnapshot['accounts'],
    positions: (root.positions ?? []) as CustodianSnapshot['positions'],
    taxLots: (root.taxLots ?? []) as CustodianSnapshot['taxLots'],
    transactions: (root.transactions ?? []) as CustodianSnapshot['transactions'],
  };
}
