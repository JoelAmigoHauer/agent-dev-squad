/**
 * Simulated adapter — deterministic fixtures for shadow mode and QA.
 *
 * Deterministic is the requirement, not a convenience: QA asserts exact drift figures, and a
 * fixture that varied would make those tests flaky in a way that looks like a guardrail bug.
 * No Math.random, no Date.now inside the data.
 *
 * The book is built to exercise the rules rather than to look plausible: US equity is deliberately
 * overweight past its band, there is a position in a sheltered account so rule 8 has something to
 * catch, and cash sits just above the floor so rule 5 is a near miss rather than a landslide.
 */

import type { CustodianAdapter, CustodianSnapshot, FirmContext } from './custodian';

export const SIMULATED_AS_OF = '2026-08-22T21:00:00.000Z';

export const SIMULATED_SECURITIES = [
  { symbol: 'VTI',  name: 'Vanguard Total Stock Market ETF', assetClass: 'us_equity',             sector: 'Diversified', isEtf: true },
  { symbol: 'VXUS', name: 'Vanguard Total International Stock ETF', assetClass: 'intl_developed_equity', sector: 'Diversified', isEtf: true },
  { symbol: 'VWO',  name: 'Vanguard Emerging Markets ETF',   assetClass: 'emerging_equity',       sector: 'Diversified', isEtf: true },
  { symbol: 'BND',  name: 'Vanguard Total Bond Market ETF',  assetClass: 'us_bond',               sector: 'Diversified', isEtf: true },
  { symbol: 'BNDX', name: 'Vanguard Total International Bond ETF', assetClass: 'intl_bond',       sector: 'Diversified', isEtf: true },
  { symbol: 'VNQ',  name: 'Vanguard Real Estate ETF',        assetClass: 'real_assets',           sector: 'Real Estate', isEtf: true },
  { symbol: 'XOM',  name: 'Exxon Mobil Corporation',         assetClass: 'us_equity',             sector: 'Energy',      isEtf: false },
] as const;

export const SIMULATED_PRICES: Record<string, number> = {
  VTI: 289.4200, VXUS: 68.1500, VWO: 47.9300, BND: 74.2600,
  BNDX: 49.8800, VNQ: 92.1100, XOM: 118.7400,
};

const snapshot: CustodianSnapshot = {
  asOf: SIMULATED_AS_OF,
  accounts: [
    { custodianAccountId: 'SIM-1001', displayName: 'Joint Taxable',   taxTreatment: 'taxable',         cashBalance: 48_200.0 },
    { custodianAccountId: 'SIM-1002', displayName: 'Rollover IRA',    taxTreatment: 'traditional_ira', cashBalance: 6_100.0 },
    { custodianAccountId: 'SIM-1003', displayName: 'Roth IRA',        taxTreatment: 'roth_ira',        cashBalance: 2_450.0 },
  ],
  positions: [
    // us_equity lands ~57% against a 45% target with a 40-50% band: over, on purpose.
    { custodianAccountId: 'SIM-1001', symbol: 'VTI',  quantity: 3_150.000000, marketValue: 911_673.00, costBasis: 604_212.00 },
    { custodianAccountId: 'SIM-1001', symbol: 'XOM',  quantity: 1_400.000000, marketValue: 166_236.00, costBasis: 189_420.00 },
    { custodianAccountId: 'SIM-1001', symbol: 'VXUS', quantity: 2_050.000000, marketValue: 139_707.50, costBasis: 151_880.00 },
    { custodianAccountId: 'SIM-1001', symbol: 'BND',  quantity: 1_900.000000, marketValue: 141_094.00, costBasis: 148_770.00 },
    { custodianAccountId: 'SIM-1002', symbol: 'BND',  quantity: 2_400.000000, marketValue: 178_224.00, costBasis: 181_900.00 },
    { custodianAccountId: 'SIM-1002', symbol: 'BNDX', quantity: 1_500.000000, marketValue:  74_820.00, costBasis:  77_250.00 },
    { custodianAccountId: 'SIM-1002', symbol: 'VWO',  quantity: 1_250.000000, marketValue:  59_912.50, costBasis:  55_400.00 },
    { custodianAccountId: 'SIM-1003', symbol: 'VNQ',  quantity:    780.000000, marketValue:  71_845.80, costBasis:  70_110.00 },
    { custodianAccountId: 'SIM-1003', symbol: 'VTI',  quantity:    260.000000, marketValue:  75_249.20, costBasis:  61_040.00 },
  ],
  taxLots: [
    { custodianAccountId: 'SIM-1001', symbol: 'VTI',  custodianLotId: 'L-001', openDate: '2019-04-11', quantity: 1_800.000000, costBasis: 313_200.00 },
    { custodianAccountId: 'SIM-1001', symbol: 'VTI',  custodianLotId: 'L-002', openDate: '2022-07-19', quantity: 1_350.000000, costBasis: 291_012.00 },
    // Held at a loss: the harvest candidate rule 8 must refuse to touch inside a sheltered account
    // and rule 7 must cost correctly inside a taxable one.
    { custodianAccountId: 'SIM-1001', symbol: 'XOM',  custodianLotId: 'L-003', openDate: '2023-02-02', quantity: 1_400.000000, costBasis: 189_420.00 },
    { custodianAccountId: 'SIM-1001', symbol: 'VXUS', custodianLotId: 'L-004', openDate: '2021-11-30', quantity: 2_050.000000, costBasis: 151_880.00 },
    { custodianAccountId: 'SIM-1001', symbol: 'BND',  custodianLotId: 'L-005', openDate: '2021-03-15', quantity: 1_900.000000, costBasis: 148_770.00 },
    { custodianAccountId: 'SIM-1002', symbol: 'BND',  custodianLotId: 'L-006', openDate: '2020-09-08', quantity: 2_400.000000, costBasis: 181_900.00 },
    { custodianAccountId: 'SIM-1002', symbol: 'BNDX', custodianLotId: 'L-007', openDate: '2021-06-21', quantity: 1_500.000000, costBasis:  77_250.00 },
    { custodianAccountId: 'SIM-1002', symbol: 'VWO',  custodianLotId: 'L-008', openDate: '2023-08-14', quantity: 1_250.000000, costBasis:  55_400.00 },
    { custodianAccountId: 'SIM-1003', symbol: 'VNQ',  custodianLotId: 'L-009', openDate: '2022-01-10', quantity:   780.000000, costBasis:  70_110.00 },
    { custodianAccountId: 'SIM-1003', symbol: 'VTI',  custodianLotId: 'L-010', openDate: '2020-05-26', quantity:   260.000000, costBasis:  61_040.00 },
  ],
  transactions: [
    { custodianAccountId: 'SIM-1001', symbol: 'VTI',  type: 'buy',      tradeDate: '2022-07-19', quantity: 1_350, price: 215.5644, amount: -291_012.00, custodianTxnId: 'T-001' },
    { custodianAccountId: 'SIM-1001', symbol: 'XOM',  type: 'buy',      tradeDate: '2023-02-02', quantity: 1_400, price: 135.3000, amount: -189_420.00, custodianTxnId: 'T-002' },
    { custodianAccountId: 'SIM-1001', symbol: 'VTI',  type: 'dividend', tradeDate: '2026-06-28',                                   amount:    4_820.00, custodianTxnId: 'T-003' },
    { custodianAccountId: 'SIM-1001',                  type: 'deposit',  tradeDate: '2026-08-01',                                   amount:   40_000.00, custodianTxnId: 'T-004' },
    // A realised gain already booked this year, so rule 7's budget check has something to add to.
    { custodianAccountId: 'SIM-1001', symbol: 'VWO',  type: 'sell',     tradeDate: '2026-03-14', quantity:   400, price:  44.1000, amount:   17_640.00, custodianTxnId: 'T-005' },
  ],
};

export const simulatedAdapter: CustodianAdapter = {
  id: 'simulated',
  capabilities: {
    holdings: true, transactions: true, taxLots: true,
    lotLevelBasis: true, orderRouting: false,
  },
  async fetchSnapshot(_ctx: FirmContext): Promise<CustodianSnapshot> {
    // Deep clone so a caller mutating the result cannot poison the next run.
    return structuredClone(snapshot);
  },
};
