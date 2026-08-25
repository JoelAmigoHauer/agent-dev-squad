/**
 * Contract §3, POST /api/custodian/import. The quarantine behaviour is the point: a silently
 * dropped holding is a portfolio that reconciles to the wrong total.
 */
import { describe, expect, it } from 'vitest';
import { parseCsv, parseExtract } from '@/lib/adapters/csv';

describe('parseCsv', () => {
  it('handles quoted fields containing commas', () => {
    expect(parseCsv('a,"b,c",d')).toEqual([['a', 'b,c', 'd']]);
  });
  it('handles doubled quotes inside a quoted field', () => {
    expect(parseCsv('a,"say ""hi""",c')).toEqual([['a', 'say "hi"', 'c']]);
  });
  it('handles CRLF line endings', () => {
    expect(parseCsv('a,b\r\nc,d')).toEqual([['a', 'b'], ['c', 'd']]);
  });
  it('drops fully blank lines', () => {
    expect(parseCsv('a,b\n\n\nc,d')).toEqual([['a', 'b'], ['c', 'd']]);
  });
});

const HEADER = 'record_type,account_id,display_name,tax_treatment,cash_balance,symbol,quantity,' +
               'market_value,cost_basis,open_date,lot_id,txn_type,trade_date,amount,txn_id';

describe('parseExtract', () => {
  it('rejects a file with no record_type column', () => {
    expect(() => parseExtract('a,b\n1,2')).toThrow(SyntaxError);
  });

  it('rejects an empty file', () => {
    expect(() => parseExtract('')).toThrow(SyntaxError);
  });

  it('parses accounts, positions, lots and transactions', () => {
    const { snapshot, quarantined } = parseExtract([
      HEADER,
      'account,A1,Joint Taxable,taxable,5000,,,,,,,,,,',
      'position,A1,,,,VTI,100,28942,20000,,,,,,',
      'tax_lot,A1,,,,VTI,100,,15000,2020-01-15,L1,,,,',
      'transaction,A1,,,,VTI,10,,,,,buy,2020-01-15,-2894.20,T1',
    ].join('\n'));

    expect(quarantined).toHaveLength(0);
    expect(snapshot.accounts).toHaveLength(1);
    expect(snapshot.accounts[0]).toMatchObject({ taxTreatment: 'taxable', cashBalance: 5000 });
    expect(snapshot.positions[0]).toMatchObject({ symbol: 'VTI', quantity: 100, marketValue: 28942 });
    expect(snapshot.taxLots[0]).toMatchObject({ symbol: 'VTI', openDate: '2020-01-15' });
    expect(snapshot.transactions[0]).toMatchObject({ type: 'buy', amount: -2894.2 });
  });

  it('quarantines rather than drops an unknown tax treatment', () => {
    const { snapshot, quarantined } = parseExtract([
      HEADER, 'account,A1,Joint,not_a_treatment,5000,,,,,,,,,,',
    ].join('\n'));
    expect(snapshot.accounts).toHaveLength(0);
    expect(quarantined[0]?.reason).toContain('unknown tax_treatment');
    expect(quarantined[0]?.row).toBe(2);
  });

  it('quarantines a position with a non-numeric quantity', () => {
    const { quarantined } = parseExtract([
      HEADER, 'position,A1,,,,VTI,not-a-number,28942,20000,,,,,,',
    ].join('\n'));
    expect(quarantined[0]?.reason).toContain('non-numeric');
  });

  it('quarantines an unknown record_type', () => {
    const { quarantined } = parseExtract([HEADER, 'nonsense,A1,,,,,,,,,,,,,'].join('\n'));
    expect(quarantined[0]?.reason).toContain('unknown record_type');
  });

  it('completes the import for valid rows even when some are quarantined', () => {
    const { snapshot, quarantined } = parseExtract([
      HEADER,
      'account,A1,Joint,taxable,5000,,,,,,,,,,',
      'account,A2,Bad,not_a_treatment,5000,,,,,,,,,,',
      'position,A1,,,,VTI,100,28942,20000,,,,,,',
    ].join('\n'));
    expect(snapshot.accounts).toHaveLength(1);
    expect(snapshot.positions).toHaveLength(1);
    expect(quarantined).toHaveLength(1);
  });

  it('strips currency formatting from amounts', () => {
    const { snapshot } = parseExtract([
      HEADER, 'position,A1,,,,VTI,100,"$28,942.00","$20,000.00",,,,,,',
    ].join('\n'));
    expect(snapshot.positions[0]?.marketValue).toBe(28942);
  });

  it('uppercases symbols so VTI and vti resolve to one security', () => {
    const { snapshot } = parseExtract([
      HEADER, 'position,A1,,,,vti,100,28942,20000,,,,,,',
    ].join('\n'));
    expect(snapshot.positions[0]?.symbol).toBe('VTI');
  });
});
