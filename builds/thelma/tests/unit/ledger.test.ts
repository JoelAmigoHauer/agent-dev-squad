/**
 * Contract §2, decision_ledger. `computeRowHash` must match the database trigger exactly — any
 * drift between the two makes verification report tampering on an untampered ledger, which is
 * worse than not verifying at all.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { computeRowHash } from '@/lib/ledger';
import type { Tables } from '@/lib/db/database.types';

const GENESIS = '0'.repeat(64);

function row(overrides: Partial<Tables<'decision_ledger'>> = {}): Tables<'decision_ledger'> {
  return {
    id: 1, firm_id: 'f1', seq: 1, occurred_at: '2026-08-24 10:00:00+00',
    actor_type: 'advisor', actor_id: 'a1', agent_identity: null,
    event_type: 'mandate.published', household_id: 'h1',
    subject_type: 'mandate', subject_id: 'm1',
    payload: { version: 2 }, data_sources: [],
    prev_hash: GENESIS, row_hash: '', ...overrides,
  };
}

describe('computeRowHash', () => {
  it('reproduces the trigger formula exactly', () => {
    const entry = row();
    const expected = createHash('sha256').update([
      GENESIS, 'f1', '1', '2026-08-24 10:00:00+00', 'advisor', 'a1', '',
      'mandate.published', JSON.stringify({ version: 2 }), JSON.stringify([]),
    ].join('|')).digest('hex');

    expect(computeRowHash(entry, GENESIS)).toBe(expected);
  });

  it('is deterministic', () => {
    expect(computeRowHash(row(), GENESIS)).toBe(computeRowHash(row(), GENESIS));
  });

  it('changes when the payload changes — tampering is detectable', () => {
    const original = computeRowHash(row(), GENESIS);
    const tampered = computeRowHash(row({ payload: { version: 3 } }), GENESIS);
    expect(tampered).not.toBe(original);
  });

  it('changes when the actor changes', () => {
    expect(computeRowHash(row({ actor_id: 'a2' }), GENESIS))
      .not.toBe(computeRowHash(row(), GENESIS));
  });

  it('changes when the previous hash changes — the chain is linked', () => {
    // This is what makes it a chain rather than a list of independent hashes: altering any
    // earlier entry invalidates every entry after it.
    const a = computeRowHash(row(), GENESIS);
    const b = computeRowHash(row(), 'f'.repeat(64));
    expect(a).not.toBe(b);
  });

  it('distinguishes an agent actor from an advisor actor', () => {
    const advisor = computeRowHash(row(), GENESIS);
    const agent = computeRowHash(
      row({ actor_type: 'agent', actor_id: null, agent_identity: 'thelma/monitor@1.0.0' }),
      GENESIS,
    );
    expect(agent).not.toBe(advisor);
  });

  it('produces a 64-character hex digest', () => {
    expect(computeRowHash(row(), GENESIS)).toMatch(/^[0-9a-f]{64}$/);
  });
});
