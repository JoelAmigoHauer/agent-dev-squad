import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, cpSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { consistency } from '../consistency.mjs';

const BINDINGS = `# Contract: flow and screen bindings — demo

## Flow bindings

| Flow | Screen | Reached from | Control | Calls | Post-condition |
|---|---|---|---|---|---|
| Create invoice | \`/invoices\` | nav "Invoices", signed in | "New invoice" | \`POST /api/invoices\` | lands on \`/invoices/:id\` |
| Mark paid | \`/invoices/:id\` | a row in \`/invoices\` | "Mark paid" | \`PATCH /api/invoices/:id\` | badge changes |

## Screen bindings

| Surface | Kind | Routes | Widths | Status |
|---|---|---|---|---|
| member shell | shell | every \`/invoices*\` route | wide, narrow | \`new\` |
| invoice list | screen | \`/invoices\` | wide, narrow | \`new\` |
| invoice detail | screen | \`/invoices/:id\` | wide, narrow | \`new\` |
`;

const API = `## API contract

\`\`\`
POST /api/invoices
  200: { id: string }
PATCH /api/invoices/[invoiceId]
  200: { status: 'paid' }
\`\`\`
`;

const COPY = `# Copy deck — demo

## /invoices — Invoice list

| id | element | state | text |
|---|---|---|---|
| \`invoices.heading\` | heading | default | Invoices |

## /invoices/:id — Invoice

| id | element | state | text |
|---|---|---|---|
| \`invoice.markPaid\` | button | default | Mark paid |
`;

const DESIGN = `# Design — demo

## Screen inventory

### \`/invoices\`
- Strings: \`invoices.heading\`

### \`/invoices/:id\`
- Strings: \`invoice.markPaid\`

## Frame index

| Surface | State | Width | Frame | As built (brownfield) |
|---|---|---|---|---|
| member shell | default | wide | 1:2 | |
| invoice list | default | wide | 1:3 | |
| invoice detail | default | wide | 1:4 | |
`;

function build(over = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'squad-build-'));
  mkdirSync(path.join(dir, 'contract'));
  writeFileSync(path.join(dir, 'contract', 'bindings.md'), over.bindings ?? BINDINGS);
  writeFileSync(path.join(dir, 'contract', 'api.md'), over.api ?? API);
  if (over.copy !== null) writeFileSync(path.join(dir, 'copy.md'), over.copy ?? COPY);
  writeFileSync(path.join(dir, 'design.md'), over.design ?? DESIGN);
  if (over.intake) writeFileSync(path.join(dir, 'intake.md'), over.intake);
  return dir;
}

const msgs = (dir) => consistency(dir).map((f) => f.msg);

test('a consistent build passes, route params in any spelling', () => assert.deepEqual(msgs(build()), []));

test('a flow on an unbound screen fails', () => {
  const b = BINDINGS.replace('| Mark paid | `/invoices/:id`', '| Mark paid | `/invoice/:id`');
  assert.match(msgs(build({ bindings: b })).join('\n'), /screen \/invoice\/:id has no screen binding row/);
});

test('a flow calling a route the API does not define fails', () => {
  const a = API.replace('PATCH /api/invoices/[invoiceId]', 'PUT /api/invoices/[invoiceId]');
  assert.match(msgs(build({ api: a })).join('\n'), /PATCH \/api\/invoices\/:id is not a route/);
});

test('a bound screen with no copy section fails', () => {
  const c = COPY.slice(0, COPY.indexOf('## /invoices/:id'));
  assert.match(msgs(build({ copy: c })).join('\n'), /copy.md has no section for \/invoices\/:id/);
});

test('a surface with no frame row fails', () => {
  const d = DESIGN.replace('| member shell | default | wide | 1:2 | |\n', '');
  assert.match(msgs(build({ design: d })).join('\n'), /no row for "member shell"/);
});

test('a designed screen nobody bound fails, and a bound screen nobody designed fails', () => {
  const d = DESIGN.replace('### `/invoices/:id`', '### `/settings`');
  const m = msgs(build({ design: d })).join('\n');
  assert.match(m, /designs \/settings, which no screen binding names/);
  assert.match(m, /inventory has no entry for \/invoices\/:id/);
});

test('a string id the deck does not define fails', () => {
  const d = DESIGN.replace('`invoice.markPaid`', '`invoice.markAsPaid`');
  assert.match(msgs(build({ design: d })).join('\n'), /invoice.markAsPaid, which copy.md does not define/);
});

test('missing files fail rather than pass', () => {
  assert.match(msgs(build({ copy: null })).join('\n'), /copy.md is missing/);
  assert.match(msgs(build({ bindings: '# empty\n' })).join('\n'), /no screen bindings rows/);
});

// C8 (WW-1): the design of record the kickoff interview settled is the one design.md indexes.
const INTAKE = (dor) => `# Intake: demo\n\n**Start:** design\n**Design of record:** ${dor}\n`;
const ROUND2 = 'Figma abc123XYZ, page "Round 2" (2026-11-12), plus route pages 40:1.';
const DESIGNED = (line) => DESIGN.replace('# Design — demo\n', `# Design — demo\n\n**Design of record:** ${line}\n`);

test('C8: design.md must index the design of record intake.md names', () => {
  const same = DESIGNED('Figma file `abc123XYZ`, page "Round 2", plus route pages `40:1`.');
  assert.deepEqual(msgs(build({ intake: INTAKE(ROUND2), design: same })), []);
  const stale = DESIGNED('Figma file `abc123XYZ`, page "Round 1", plus route pages `25:2`.');
  assert.match(msgs(build({ intake: INTAKE(ROUND2), design: stale })).join('\n'), /indexes .*Round 1.*but intake.md names .*Round 2.* \(WW-1\)/);
  const other = DESIGNED('Figma file `zzz999ZZZ`, page "Round 2".');
  assert.match(msgs(build({ intake: INTAKE(ROUND2), design: other })).join('\n'), /as the design of record/);
  assert.match(msgs(build({ intake: INTAKE(ROUND2) })).join('\n'), /design.md has no Design of record line/);
});

test('C8: no design of record, or no intake, checks nothing', () => {
  assert.deepEqual(msgs(build({ intake: INTAKE('none (the Designer draws from the copy deck and the contract)') })), []);
  assert.deepEqual(msgs(build({ intake: INTAKE('<Figma key, page>') })), []);
});

test('the build folder templates parse: placeholders are skipped, not matched', () => {
  const tpl = fileURLToPath(new URL('../../builds/_template', import.meta.url));
  const dir = mkdtempSync(path.join(tmpdir(), 'squad-tpl-'));
  cpSync(tpl, dir, { recursive: true });
  // The scaffold has only placeholder rows, so the one finding is that nothing is bound yet.
  assert.deepEqual(msgs(dir), ['contract/bindings.md has no screen bindings rows']);
});

test('the gate blocks an Engineer start in a host, and the CLI reports', () => {
  const host = mkdtempSync(path.join(tmpdir(), 'squad-host-'));
  const squad = path.join(host, '.squad');
  cpSync(fileURLToPath(new URL('..', import.meta.url)), path.join(squad, 'checks'), { recursive: true });
  mkdirSync(path.join(squad, 'state'), { recursive: true });
  const b = build({ design: DESIGN.replace('| member shell | default | wide | 1:2 | |\n', '') });
  mkdirSync(path.join(squad, 'builds'), { recursive: true });
  cpSync(b, path.join(squad, 'builds', 'demo'), { recursive: true });
  const state = path.join(squad, 'state', 'demo.md');
  writeFileSync(state, 'build: demo\nstage-3-engineer: pending\nwaived: none\n');
  const call = { tool_name: 'Edit', tool_input: { file_path: state, old_string: 'stage-3-engineer: pending', new_string: 'stage-3-engineer: running' } };
  const r = spawnSync('node', [path.join(squad, 'checks', 'hook.mjs')], { input: JSON.stringify(call), encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /\[consistency-gate\] stage-3-engineer cannot start: design.md frame index has no row for "member shell"/);
  const cli = spawnSync('node', [path.join(squad, 'checks', 'consistency.mjs'), path.join(squad, 'builds', 'demo')], { encoding: 'utf8' });
  assert.equal(cli.status, 1);
  assert.match(cli.stdout, /1 mismatch/);
});
