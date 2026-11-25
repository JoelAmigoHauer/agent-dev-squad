// intake-gate: the kickoff interview (skills/kickoff-interview.md) is finished before Preflight,
// its format reaches the state file, and its banned words stay out of the copy deck.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  INTAKE_ROWS, GUARD_ROWS, FORMATS, parseIntake, intakeProblems, bannedPattern,
} from '../intake.mjs';
import { intakeGate, bannedWordGate, lintState } from '../lib.mjs';

const readRepo = (p) => readFileSync(fileURLToPath(new URL(`../../${p}`, import.meta.url)), 'utf8');
const checks = (fs) => fs.map((f) => f.check);
const joined = (fs) => fs.map((f) => f.msg).join('\n');

// A finished intake for an idea start: every row answered, guard and idea rows asked.
const ROW = {
  P1: 'Couples lose track of RSVPs across group chats', P2: 'A couple, the evening after invites go out',
  P3: 'RSVPs logged within a week of invites; target 90%', F1: 'On the move, phone', F2: 'Weekly',
  F3: 'Notifications only', F4: 'A finished job', F5: 'Two people sharing one guest list',
  F6: 'Free while P3 is proven', F7: 'No, it stands alone',
  F8: 'A shared spreadsheet would do it, but guests will not edit one', F9: '`web-app`: phone first, two users, no native need',
  P4: 'Add guests; send invite link; guest RSVPs; couple sees totals', P5: 'Seating, gifts, payments',
  D1: 'Round 2 is final; the empty Guests state is open', D2: 'shadcn defaults, derived tokens',
  D3: 'Empty, error, loading', C1: 'Warm, plain, second person, Australian spelling', C2: '`delve`, `leverag*`, `seamless`',
  C3: 'no figures', E1: 'New code, nothing to break', E2: 'All real; no third party yet',
  E3: 'Couple by email link; guests by invite token', E4: 'Guest names and emails; Sydney region',
  Q1: 'Phone and desktop widths, Chromium', Q2: 'No serious or critical axe violations',
  O1: '2026-12-20; cut totals first', O2: 'Joel, within a working day',
};
const source = (id) => (id === 'F9' || id === 'P4' ? 'confirmed: drafted' : 'Joel');

function intake({ start = 'idea', dor = 'Figma abc123XYZ, page "Round 2" (2026-11-12), plus route pages 40:1.', rows = {}, sources = {}, drop = [] } = {}) {
  const body = INTAKE_ROWS.filter((id) => !drop.includes(id))
    .map((id) => `| ${id} | x | q | ${GUARD_ROWS.includes(id) ? 'yes' : 'no'} | ${rows[id] ?? ROW[id]} | ${sources[id] ?? source(id)} |`)
    .join('\n');
  return `# Intake: demo\n\n**Start:** ${start}\n**Design of record:** ${dor}\n**Read:** the topic only\n\n## Answers\n\n| ID | Discipline | Question | Guard | Answer | Source |\n|---|---|---|---|---|---|\n${body}\n`;
}

const STATE = `build:               demo
mode:                greenfield
format:              web-app
started:             2026-11-25T23:50
stage-0.25-surveyor: skipped (greenfield)
stage-0-intake:      running
stage-0.5-preflight: pending
stage-2-designer:    pending
standing:            none
waived:              none
escalations:         none
`;
const DONE = STATE.replace('stage-0-intake:      running', 'stage-0-intake:      done    (/builds/demo/intake.md, 18 asked, 10 read, 2 drafted)');
const PREFLIGHT = DONE.replace('stage-0.5-preflight: pending', 'stage-0.5-preflight: running');

// The skill's bank table and the code bind the same rows, guards and formats.
test('the question bank in the skill matches the rows the gate binds', () => {
  const skill = readRepo('skills/kickoff-interview.md');
  const bank = [...skill.matchAll(/^\| ([A-Z]\d+) \| [^|]+\| [^|]+\| (yes|no) \|/gm)].map((m) => [m[1], m[2]]);
  assert.deepEqual(bank.map(([id]) => id), INTAKE_ROWS);
  assert.deepEqual(bank.filter(([, g]) => g === 'yes').map(([id]) => id).sort(), [...GUARD_ROWS].sort());
  const step5 = skill.slice(skill.indexOf('## Step 5'), skill.indexOf('## Step 6'));
  const formats = [...step5.matchAll(/^\| `([a-z-]+)` \| /gm)].map((m) => m[1]);
  assert.deepEqual(formats, FORMATS);
});

test('the intake template has every row, and is refused until filled', () => {
  const tpl = readRepo('builds/_template/intake.md');
  const { rows } = parseIntake(tpl);
  assert.deepEqual(rows.map((r) => r.id), INTAKE_ROWS);
  const m = intakeProblems(tpl).join('\n');
  assert.match(m, /\*\*Start:\*\*/);
  assert.match(m, /Design of record/);
  assert.match(m, /P1 is not answered/);
});

test('a finished intake has no problems', () => assert.deepEqual(intakeProblems(intake()), []));

test('a missing intake, a missing row, a blank or a [DRAFT] answer are problems', () => {
  assert.deepEqual(intakeProblems(null), ['intake.md is missing']);
  assert.match(intakeProblems(intake({ drop: ['E3'] })).join('\n'), /E3 has no row/);
  assert.match(intakeProblems(intake({ rows: { Q1: '<answer>' } })).join('\n'), /Q1 is not answered/);
  assert.match(intakeProblems(intake({ rows: { O1: 'No date [DRAFT]' } })).join('\n'), /O1 is still a \[DRAFT\]/);
  assert.match(intakeProblems(intake({ sources: { D2: 'guessed' } })).join('\n'), /D2 source "guessed"/);
  assert.match(intakeProblems(intake({ start: 'napkin' })).join('\n'), /\*\*Start:\*\* is "napkin"/);
  assert.match(intakeProblems(intake({ dor: '<Figma key>' })).join('\n'), /Design of record/);
});

test('a guard row is always asked, even when the material answered it', () => {
  const m = intakeProblems(intake({ start: 'brief', sources: { C3: 'read: brief.md' } })).join('\n');
  assert.match(m, /C3 is a guard row/);
  assert.deepEqual(intakeProblems(intake({ start: 'brief', sources: { C3: 'confirmed: read brief.md', E2: 'read: brief.md' } })), []);
});

test('on an idea start, the problem, user, metric and format rows are asked, not read', () => {
  assert.match(intakeProblems(intake({ sources: { P2: 'read: the topic' } })).join('\n'), /P2 is sourced read: on an idea start/);
  assert.match(intakeProblems(intake({ sources: { F3: 'read: the topic' } })).join('\n'), /F3 is sourced read: on an idea start/);
  assert.deepEqual(intakeProblems(intake({ start: 'repo', sources: { P2: 'read: survey.md §10' } })), []);
});

test('C2 must list banned words in backticks or say none; F9 must name a format', () => {
  assert.match(intakeProblems(intake({ rows: { C2: 'the usual ones' } })).join('\n'), /C2 lists no banned word/);
  assert.deepEqual(intakeProblems(intake({ rows: { C2: 'none' } })), []);
  assert.match(intakeProblems(intake({ rows: { F9: 'an app' } })).join('\n'), /F9 names format ""/);
  assert.match(intakeProblems(intake({ rows: { F9: '`android`, because' } })).join('\n'), /F9 names format "android"/);
});

test('state-lint: format is — or one of the formats', () => {
  assert.deepEqual(lintState(STATE), []);
  assert.deepEqual(lintState(STATE.replace('format:              web-app', 'format:              —')), []);
  assert.deepEqual(checks(lintState(STATE.replace('format:              web-app', 'format: website'))), ['state-lint']);
});

test('intake-gate: stage-0-intake cannot be done while intake.md is unfinished', () => {
  assert.deepEqual(checks(intakeGate(STATE, DONE, intake({ rows: { P5: '<answer>' } }))), ['intake-gate']);
  assert.deepEqual(checks(intakeGate(STATE, DONE, null)), ['intake-gate']);
  assert.deepEqual(intakeGate(STATE, DONE, intake()), []);
});

test('intake-gate: Preflight cannot start before the intake is done', () => {
  const early = STATE.replace('stage-0.5-preflight: pending', 'stage-0.5-preflight: running');
  assert.match(joined(intakeGate(STATE, early, intake())), /stage-0-intake is "running", not done/);
  assert.deepEqual(intakeGate(DONE, PREFLIGHT, intake()), []);
});

test('intake-gate: the state file carries the format F9 settled', () => {
  const wrong = PREFLIGHT.replace('format:              web-app', 'format:              saas');
  assert.match(joined(intakeGate(DONE, wrong, intake())), /format: is "saas", but intake.md F9 settled "web-app"/);
  const unset = DONE.replace('format:              web-app', 'format:              —');
  assert.deepEqual(checks(intakeGate(STATE, unset, intake())), ['intake-gate']);
});

test('intake-gate: a not-software build ends at Stage 0', () => {
  const ns = intake({ rows: { F9: '`not-software`: a shared spreadsheet and a weekly reminder' } });
  const done = DONE.replace('format:              web-app', 'format:              not-software');
  assert.deepEqual(intakeGate(STATE, done, ns), []);
  const pre = done.replace('stage-0.5-preflight: pending', 'stage-0.5-preflight: running');
  assert.match(joined(intakeGate(done, pre, ns)), /not-software, so the build ends at Stage 0/);
});

test('intake-gate: an edit that moves neither line passes, whatever the intake says', () => {
  assert.deepEqual(intakeGate(DONE, DONE.replace('stage-2-designer:    pending', 'stage-2-designer: pending'), null), []);
  assert.deepEqual(intakeGate(PREFLIGHT, PREFLIGHT, null), []);
});

const DECK = `## /guests — Guests

| id | element | state | text |
|---|---|---|---|
| \`guests.heading\` | heading | default | Your guests |
| \`guests.empty\` | body | empty | Add your first guest to get going |
`;
const DESIGNER = DONE.replace('stage-2-designer:    pending', 'stage-2-designer: running');

test('intake-gate: no Designer starts while the deck uses a banned word', () => {
  const bad = DECK.replace('Add your first guest', 'Leveraging our seamless list, add your first guest');
  const m = joined(bannedWordGate(DONE, DESIGNER, intake(), bad));
  assert.match(m, /line 6 uses "leverag\*"/);
  assert.match(m, /line 6 uses "seamless"/);
  assert.deepEqual(bannedWordGate(DONE, DESIGNER, intake(), DECK), []);
});

test('intake-gate: banned words skip existing strings and match whole words only', () => {
  const existing = DECK.replace('Add your first guest to get going |', 'A seamless start | [existing: app/guests.tsx]');
  assert.deepEqual(bannedWordGate(DONE, DESIGNER, intake(), existing), []);
  assert.equal(bannedPattern('delve').test('Delve into it'), true);
  assert.equal(bannedPattern('delve').test('delved'), false);
  assert.equal(bannedPattern('leverag*').test('leveraged'), true);
  assert.equal(bannedPattern('best practice').test('Best  practice here'), true);
  assert.deepEqual(bannedWordGate(DONE, DESIGNER, intake({ rows: { C2: 'none' } }), DECK.replace('Your', 'Seamless')), []);
});

test('intake-gate: an amendment set Designer is checked too', () => {
  const base = DONE + 'amendment-set-1 (A1):\n  stage-2-designer: pending\n';
  const after = base.replace('  stage-2-designer: pending', '  stage-2-designer: running');
  assert.deepEqual(checks(bannedWordGate(base, after, intake(), DECK.replace('Your', 'Delve into your'))), ['intake-gate']);
});
