// The kickoff interview's brief, intake.md (Stage 0, skills/kickoff-interview.md). Parsing and the
// list of problems that keep it from being done. lib.mjs turns these into intake-gate failures.
// The row IDs, guard rows and formats below bind; the skill's bank table must match them, and a
// test fails when it does not.

import { tableAfter } from './md.mjs';

export const INTAKE_ROWS = [
  'P1', 'P2', 'P3', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'P4', 'P5',
  'D1', 'D2', 'D3', 'C1', 'C2', 'C3', 'E1', 'E2', 'E3', 'E4', 'Q1', 'Q2', 'O1', 'O2',
];
// Asked on every build, even when the read pass filled them.
export const GUARD_ROWS = ['F8', 'F9', 'P4', 'P5', 'D1', 'C1', 'C2', 'C3'];
// Also asked on an idea start: with nothing to read, a filled row means a skipped question.
export const IDEA_ROWS = ['P1', 'P2', 'P3', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7'];
export const STARTS = ['idea', 'brief', 'design', 'repo'];
export const FORMATS = ['web-app', 'saas', 'game', 'iphone', 'integration', 'not-software'];

const clean = (c) => (c ?? '').replace(/`/g, '').trim();
const placeholder = (c) => !clean(c) || /<[^>]*>/.test(c);
const line = (text, label) => {
  const m = text.match(new RegExp(`^\\*\\*${label}:\\*\\*[ \\t]*(.*)$`, 'm'));
  return m ? m[1].trim() : null;
};

export function parseIntake(text) {
  const rows = tableAfter(text, /^#{2,6}\s+answers/i).filter((r) => /^[A-Z]\d+$/.test(clean(r.id)));
  return {
    start: clean(line(text, 'Start') ?? ''),
    designOfRecord: line(text, 'Design of record'),
    rows: rows.map((r) => ({ id: clean(r.id), answer: r.answer ?? '', source: clean(r.source) })),
  };
}

const ticked = (s) => [...(s ?? '').matchAll(/`([^`]+)`/g)].map((m) => m[1].trim()).filter(Boolean);

export function formatOf(intakeText) {
  if (!intakeText) return null;
  const f9 = parseIntake(intakeText).rows.find((r) => r.id === 'F9');
  return f9 ? (ticked(f9.answer)[0] ?? null) : null;
}

export function bannedWords(intakeText) {
  if (!intakeText) return [];
  const c2 = parseIntake(intakeText).rows.find((r) => r.id === 'C2');
  return c2 ? ticked(c2.answer) : [];
}

// Every reason intake.md is not yet a finished brief. Empty means done.
export function intakeProblems(text) {
  if (text === null || text === undefined) return ['intake.md is missing'];
  const { start, designOfRecord, rows } = parseIntake(text);
  const out = [];
  if (!STARTS.includes(start)) out.push(`**Start:** is "${start}", not one of ${STARTS.join(', ')}`);
  if (designOfRecord === null || placeholder(designOfRecord)) {
    out.push('**Design of record:** is not filled; name the design, or write none');
  }
  const seen = new Map();
  for (const r of rows) {
    if (!INTAKE_ROWS.includes(r.id)) out.push(`${r.id} is not a row in the question bank`);
    if (seen.has(r.id)) out.push(`${r.id} has two rows`);
    seen.set(r.id, r);
  }
  for (const id of INTAKE_ROWS) {
    const r = seen.get(id);
    if (!r) {
      out.push(`${id} has no row`);
      continue;
    }
    if (placeholder(r.answer)) out.push(`${id} is not answered`);
    else if (/\[DRAFT\]/.test(r.answer)) out.push(`${id} is still a [DRAFT], not confirmed`);
    if (!/^(read: \S.*|Joel|confirmed: \S.*)$/.test(r.source) || placeholder(r.source)) {
      out.push(`${id} source "${r.source}" is not read: <where>, Joel, or confirmed: <how>`);
    } else if (r.source.startsWith('read:') && GUARD_ROWS.includes(id)) {
      out.push(`${id} is a guard row, asked on every build; it cannot be sourced read:`);
    } else if (r.source.startsWith('read:') && start === 'idea' && IDEA_ROWS.includes(id)) {
      out.push(`${id} is sourced read: on an idea start, where there is nothing to read; ask it`);
    }
  }
  const c2 = seen.get('C2');
  if (c2 && !placeholder(c2.answer) && clean(c2.answer).toLowerCase() !== 'none' && !ticked(c2.answer).length) {
    out.push('C2 lists no banned word in backticks; write `word`, `phrase`, or none');
  }
  const f9 = seen.get('F9');
  if (f9 && !placeholder(f9.answer)) {
    const f = ticked(f9.answer)[0];
    if (!FORMATS.includes(f)) out.push(`F9 names format "${f ?? ''}", not one of ${FORMATS.join(', ')} in backticks`);
  }
  return out;
}

// A banned word or phrase as a whole-word, case-insensitive pattern. A trailing * matches any
// ending, so `leverag*` catches leverage, leveraged and leveraging.
export function bannedPattern(word) {
  const stem = word.endsWith('*');
  const body = (stem ? word.slice(0, -1) : word).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  return new RegExp(`(^|[^\\p{L}\\p{N}])${body}${stem ? '[\\p{L}\\p{N}]*' : ''}(?=$|[^\\p{L}\\p{N}])`, 'iu');
}
