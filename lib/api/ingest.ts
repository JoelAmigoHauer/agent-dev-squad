/**
 * Snapshot -> database. Shared by the CSV import route and the aggregator sync route, because
 * two ingest paths writing positions slightly differently is how a household's totals start
 * depending on which route loaded them.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Enums } from '@/lib/db/database.types';
import type { CustodianSnapshot } from '@/lib/adapters/custodian';

type Client = SupabaseClient<Database>;

export interface IngestResult {
  asOf: string;
  accounts: number;
  positions: number;
  taxLots: number;
  transactions: number;
  quarantined: { row: number; reason: string }[];
}

export class StaleExtractError extends Error {
  constructor(readonly extractAsOf: string, readonly currentAsOf: string) {
    super('stale extract');
  }
}

/** Asset class for a symbol we have never seen. `other`, never a guess — a security silently
 *  filed under us_equity would shift every band percentage for that household. */
const UNKNOWN_ASSET_CLASS: Enums<'asset_class'> = 'other';

export async function ingestSnapshot(
  supabase: Client,
  opts: { firmId: string; householdId: string; custodian: string },
  snapshot: CustodianSnapshot,
  quarantined: { row: number; reason: string }[] = [],
): Promise<IngestResult> {
  const { firmId, householdId, custodian } = opts;

  const { data: existingAccounts } = await supabase
    .from('accounts').select('id, as_of').eq('household_id', householdId);
  const newestExisting = (existingAccounts ?? [])
    .map((a) => a.as_of).filter((v): v is string => !!v).sort().at(-1);
  if (newestExisting && snapshot.asOf < newestExisting) {
    throw new StaleExtractError(snapshot.asOf, newestExisting);
  }

  // --- accounts ---
  const accountIdByCustodianId = new Map<string, string>();
  for (const account of snapshot.accounts) {
    const { data } = await supabase
      .from('accounts')
      .upsert({
        firm_id: firmId, household_id: householdId, custodian,
        custodian_account_id: account.custodianAccountId,
        display_name: account.displayName, tax_treatment: account.taxTreatment,
        cash_balance: account.cashBalance, as_of: snapshot.asOf,
      }, { onConflict: 'firm_id,custodian,custodian_account_id' })
      .select('id').single();
    if (data) accountIdByCustodianId.set(account.custodianAccountId, data.id);
  }

  // --- securities: resolve by symbol, create on first sight ---
  const symbols = [...new Set([
    ...snapshot.positions.map((p) => p.symbol),
    ...snapshot.taxLots.map((l) => l.symbol),
    ...snapshot.transactions.map((t) => t.symbol).filter((s): s is string => !!s),
  ])];
  const securityIdBySymbol = new Map<string, string>();
  if (symbols.length) {
    const { data: known } = await supabase.from('securities').select('id, symbol').in('symbol', symbols);
    for (const s of known ?? []) securityIdBySymbol.set(s.symbol, s.id);
    for (const symbol of symbols) {
      if (securityIdBySymbol.has(symbol)) continue;
      const { data } = await supabase
        .from('securities')
        .upsert({ symbol, name: symbol, asset_class: UNKNOWN_ASSET_CLASS }, { onConflict: 'symbol' })
        .select('id').single();
      if (data) securityIdBySymbol.set(symbol, data.id);
    }
  }

  // --- positions ---
  const positionRows = snapshot.positions.flatMap((p) => {
    const accountId = accountIdByCustodianId.get(p.custodianAccountId);
    const securityId = securityIdBySymbol.get(p.symbol);
    if (!accountId || !securityId) {
      quarantined.push({ row: 0, reason: `position for unknown account/symbol ${p.custodianAccountId}/${p.symbol}` });
      return [];
    }
    return [{
      firm_id: firmId, account_id: accountId, security_id: securityId,
      quantity: p.quantity, market_value: p.marketValue, cost_basis: p.costBasis,
      as_of: snapshot.asOf,
    }];
  });
  if (positionRows.length) {
    await supabase.from('positions')
      .upsert(positionRows, { onConflict: 'account_id,security_id,as_of' });
  }

  // --- tax lots ---
  const lotRows = snapshot.taxLots.flatMap((l) => {
    const accountId = accountIdByCustodianId.get(l.custodianAccountId);
    const securityId = securityIdBySymbol.get(l.symbol);
    if (!accountId || !securityId) return [];
    return [{
      firm_id: firmId, account_id: accountId, security_id: securityId,
      custodian_lot_id: l.custodianLotId ?? null, open_date: l.openDate,
      quantity: l.quantity, cost_basis: l.costBasis, as_of: snapshot.asOf,
    }];
  });
  if (lotRows.length) {
    // Lots are replaced per as_of rather than accumulated: a custodian restates them, and
    // appending would double-count the same shares.
    const accountIds = [...accountIdByCustodianId.values()];
    await supabase.from('tax_lots').delete().in('account_id', accountIds).eq('as_of', snapshot.asOf);
    await supabase.from('tax_lots').insert(lotRows);
  }

  // --- transactions ---
  const txnRows = snapshot.transactions.flatMap((t) => {
    const accountId = accountIdByCustodianId.get(t.custodianAccountId);
    if (!accountId) return [];
    return [{
      firm_id: firmId, account_id: accountId,
      security_id: t.symbol ? securityIdBySymbol.get(t.symbol) ?? null : null,
      txn_type: t.type, trade_date: t.tradeDate, settle_date: t.settleDate ?? null,
      quantity: t.quantity ?? null, price: t.price ?? null, amount: t.amount,
      custodian_txn_id: t.custodianTxnId ?? null,
    }];
  });
  if (txnRows.length) {
    await supabase.from('transactions')
      .upsert(txnRows, { onConflict: 'account_id,custodian_txn_id', ignoreDuplicates: true });
  }

  return {
    asOf: snapshot.asOf,
    accounts: accountIdByCustodianId.size,
    positions: positionRows.length,
    taxLots: lotRows.length,
    transactions: txnRows.length,
    quarantined,
  };
}
