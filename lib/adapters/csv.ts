/**
 * CSV adapter — the file-based route every custodian can already produce today.
 *
 * This is one of the two adapters QA actually drives, and the one a pilot firm runs on until a
 * vendor credential lands. It is not a stub.
 */

import type {
  CustodianAdapter, CustodianSnapshot, FirmContext,
  SnapshotAccount, SnapshotPosition, SnapshotTaxLot, SnapshotTransaction,
} from './custodian';
import type { Enums } from '@/lib/db/database.types';

export interface ParseResult {
  snapshot: CustodianSnapshot;
  quarantined: { row: number; reason: string }[];
}

const TAX_TREATMENTS = new Set<string>([
  'taxable', 'traditional_ira', 'roth_ira', 'employer_401k', 'trust', 'other',
]);
const TXN_TYPES = new Set<string>([
  'buy', 'sell', 'dividend', 'interest', 'deposit', 'withdrawal', 'fee',
  'transfer_in', 'transfer_out',
]);

/** RFC4180-ish: handles quoted fields and doubled quotes inside them. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else field += ch;
      continue;
    }
    if (ch === '"') { inQuotes = true; continue; }
    if (ch === ',') { row.push(field); field = ''; continue; }
    if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
      continue;
    }
    field += ch;
  }
  row.push(field);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  return rows;
}

/**
 * One flat extract with a `record_type` discriminator, because that is what advisors can export
 * and hand over as a single file. Rows that cannot be resolved are quarantined and reported —
 * never dropped. A silently dropped holding is a portfolio that reconciles to the wrong total.
 */
export function parseExtract(text: string): ParseResult {
  const rows = parseCsv(text);
  const quarantined: { row: number; reason: string }[] = [];
  const accounts: SnapshotAccount[] = [];
  const positions: SnapshotPosition[] = [];
  const taxLots: SnapshotTaxLot[] = [];
  const transactions: SnapshotTransaction[] = [];

  if (rows.length === 0) throw new SyntaxError('empty file');
  const header = rows[0]!.map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);
  if (idx('record_type') === -1) {
    throw new SyntaxError('missing required column: record_type');
  }

  const num = (v: string | undefined) => {
    const n = Number(String(v ?? '').replace(/[$,\s]/g, ''));
    return Number.isFinite(n) ? n : null;
  };

  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r]!;
    const get = (name: string) => cells[idx(name)]?.trim();
    const type = get('record_type')?.toLowerCase();
    const accountId = get('account_id');
    const lineNo = r + 1;

    if (!accountId) { quarantined.push({ row: lineNo, reason: 'missing account_id' }); continue; }

    if (type === 'account') {
      const treatment = (get('tax_treatment') ?? '').toLowerCase();
      if (!TAX_TREATMENTS.has(treatment)) {
        quarantined.push({ row: lineNo, reason: `unknown tax_treatment: ${treatment || '(blank)'}` });
        continue;
      }
      accounts.push({
        custodianAccountId: accountId,
        displayName: get('display_name') || accountId,
        taxTreatment: treatment as Enums<'account_tax_treatment'>,
        cashBalance: num(get('cash_balance')) ?? 0,
      });
    } else if (type === 'position') {
      const symbol = get('symbol');
      const quantity = num(get('quantity'));
      const marketValue = num(get('market_value'));
      if (!symbol) { quarantined.push({ row: lineNo, reason: 'missing symbol' }); continue; }
      if (quantity === null || marketValue === null) {
        quarantined.push({ row: lineNo, reason: 'non-numeric quantity or market_value' });
        continue;
      }
      positions.push({
        custodianAccountId: accountId, symbol: symbol.toUpperCase(),
        cusip: get('cusip') || undefined,
        quantity, marketValue, costBasis: num(get('cost_basis')) ?? 0,
      });
    } else if (type === 'tax_lot') {
      const symbol = get('symbol');
      const openDate = get('open_date');
      const quantity = num(get('quantity'));
      if (!symbol || !openDate || quantity === null || quantity <= 0) {
        quarantined.push({ row: lineNo, reason: 'tax_lot needs symbol, open_date and quantity > 0' });
        continue;
      }
      taxLots.push({
        custodianAccountId: accountId, symbol: symbol.toUpperCase(),
        custodianLotId: get('lot_id') || undefined,
        openDate, quantity, costBasis: num(get('cost_basis')) ?? 0,
      });
    } else if (type === 'transaction') {
      const txnType = (get('txn_type') ?? '').toLowerCase();
      const tradeDate = get('trade_date');
      const amount = num(get('amount'));
      if (!TXN_TYPES.has(txnType)) {
        quarantined.push({ row: lineNo, reason: `unknown txn_type: ${txnType || '(blank)'}` });
        continue;
      }
      if (!tradeDate || amount === null) {
        quarantined.push({ row: lineNo, reason: 'transaction needs trade_date and amount' });
        continue;
      }
      transactions.push({
        custodianAccountId: accountId,
        symbol: get('symbol')?.toUpperCase() || undefined,
        type: txnType as Enums<'transaction_type'>,
        tradeDate, settleDate: get('settle_date') || undefined,
        quantity: num(get('quantity')) ?? undefined,
        price: num(get('price')) ?? undefined,
        amount, custodianTxnId: get('txn_id') || undefined,
      });
    } else {
      quarantined.push({ row: lineNo, reason: `unknown record_type: ${type || '(blank)'}` });
    }
  }

  const asOf = new Date().toISOString();
  return { snapshot: { asOf, accounts, positions, taxLots, transactions }, quarantined };
}

export const csvAdapter: CustodianAdapter = {
  id: 'csv',
  capabilities: {
    holdings: true, transactions: true, taxLots: true,
    lotLevelBasis: true, orderRouting: false,
  },
  async fetchSnapshot(_ctx: FirmContext, payload?: unknown): Promise<CustodianSnapshot> {
    if (typeof payload !== 'string') throw new SyntaxError('csv adapter expects file text');
    return parseExtract(payload).snapshot;
  },
};
