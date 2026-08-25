/**
 * Decision ledger — append and verify. Contract.md §2 and §3.
 *
 * Appending goes through the service role because `decision_ledger` has no INSERT policy at all,
 * so no authenticated user can write it directly. The hash chain itself is computed by a database
 * trigger, not here: a chain computed by the application could be bypassed by anything that gets
 * a connection, and the whole claim this table makes is that it cannot be.
 */

import { createHash } from 'node:crypto';
import { getServiceClient } from './db/server';
import type { Json, Tables } from './db/database.types';

export type LedgerActor =
  | { type: 'advisor'; advisorId: string }
  | { type: 'agent'; identity: string }
  | { type: 'system' };

export interface LedgerAppend {
  firmId: string;
  actor: LedgerActor;
  eventType: string;
  householdId?: string | null;
  subjectType?: string | null;
  subjectId?: string | null;
  payload: Json;
  dataSources?: Json;
}

export async function appendLedger(entry: LedgerAppend): Promise<{ seq: number }> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('decision_ledger')
    .insert({
      firm_id: entry.firmId,
      actor_type: entry.actor.type,
      actor_id: entry.actor.type === 'advisor' ? entry.actor.advisorId : null,
      agent_identity: entry.actor.type === 'agent' ? entry.actor.identity : null,
      event_type: entry.eventType,
      household_id: entry.householdId ?? null,
      subject_type: entry.subjectType ?? null,
      subject_id: entry.subjectId ?? null,
      payload: entry.payload,
      data_sources: entry.dataSources ?? [],
      // seq, prev_hash and row_hash are all overwritten by trg_ledger_hash. They are sent only
      // because the columns are NOT NULL; the values here never survive the trigger.
      seq: 0,
      prev_hash: '',
      row_hash: '',
    })
    .select('seq')
    .single();

  if (error) throw new Error(`ledger append failed: ${error.message}`);
  return { seq: Number(data.seq) };
}

const GENESIS = '0'.repeat(64);

/** Recomputes a row's hash exactly as trg_ledger_hash does. Any drift between the two is a bug. */
export function computeRowHash(row: Tables<'decision_ledger'>, prevHash: string): string {
  const parts = [
    prevHash,
    row.firm_id,
    String(row.seq),
    row.occurred_at,
    row.actor_type,
    row.actor_id ?? '',
    row.agent_identity ?? '',
    row.event_type,
    JSON.stringify(row.payload),
    JSON.stringify(row.data_sources),
  ];
  return createHash('sha256').update(parts.join('|')).digest('hex');
}

export type VerifyResult =
  | { intact: true; entries: number; headHash: string }
  | { intact: false; firstDivergentSeq: number; expected: string; found: string };

/**
 * Walks the firm's chain in seq order and recomputes every hash.
 *
 * Returns a result rather than throwing on a broken chain: a tamper report is a *successful*
 * verification reporting a true fact, and surfacing it as an error would make the most important
 * thing this system can say look like an outage.
 */
export async function verifyChain(firmId: string): Promise<VerifyResult> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('decision_ledger')
    .select('*')
    .eq('firm_id', firmId)
    .order('seq', { ascending: true });

  if (error) throw new Error(`ledger verify failed: ${error.message}`);

  let prevHash = GENESIS;
  for (const row of data ?? []) {
    if (row.prev_hash !== prevHash) {
      return {
        intact: false,
        firstDivergentSeq: Number(row.seq),
        expected: prevHash,
        found: row.prev_hash,
      };
    }
    const recomputed = computeRowHash(row, prevHash);
    if (recomputed !== row.row_hash) {
      return {
        intact: false,
        firstDivergentSeq: Number(row.seq),
        expected: recomputed,
        found: row.row_hash,
      };
    }
    prevHash = row.row_hash;
  }

  return { intact: true, entries: data?.length ?? 0, headHash: prevHash };
}
