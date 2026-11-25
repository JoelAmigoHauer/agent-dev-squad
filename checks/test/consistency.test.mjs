import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, cpSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { consistency, designFreshness } from '../consistency.mjs';

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

Design round: 2 (Figma demo file, page "Round 2", indexed 2026-11-25)

## Screen inventory

### \`/invoices\`
- Strings: \`invoices.heading\`

### \`/invoices/:id\`
- Strings: \`invoice.markPaid\`

## Frame index

| Surface | State | Width | Round | Frame | As built (brownfield) |
|---|---|---|---|---|---|
| member shell | default | wide | 2 | 1:2 | |
| invoice list | default | wide | 2 | 1:3 | |
| invoice detail | default | wide | 2 | 1:4 | |
`;

function build(over = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'squad-build-'));
  mkdirSync(path.join(dir, 'contract'));
  writeFileSync(path.join(dir, 'contract', 'bindings.md'), over.bindings ?? BINDINGS);
  writeFileSync(path.join(dir, 'contract', 'api.md'), over.api ?? API);
  if (over.copy !== null) writeFileSync(path.join(dir, 'copy.md'), over.copy ?? COPY);
  writeFileSync(path.join(dir, 'design.md'), over.design ?? DESIGN);
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
  const d = DESIGN.replace('| member shell | default | wide | 2 | 1:2 | |\n', '');
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
  const b = build({ design: DESIGN.replace('| member shell | default | wide | 2 | 1:2 | |\n', '') });
  mkdirSync(path.join(squad, 'builds'), { recursive: true });
  cpSync(b, path.join(squad, 'builds', 'demo'), { recursive: true });
  const state = path.join(squad, 'state', 'demo.md');
  writeFileSync(state, 'build: demo\ndesign-round: 2 (Figma demo file, landed 2026-11-18)\nstage-3-engineer: pending\nwaived: none\n');
  const call = { tool_name: 'Edit', tool_input: { file_path: state, old_string: 'stage-3-engineer: pending', new_string: 'stage-3-engineer: running' } };
  const r = spawnSync('node', [path.join(squad, 'checks', 'hook.mjs')], { input: JSON.stringify(call), encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /\[consistency-gate\] stage-3-engineer cannot start: design.md frame index has no row for "member shell"/);
  const cli = spawnSync('node', [path.join(squad, 'checks', 'consistency.mjs'), path.join(squad, 'builds', 'demo')], { encoding: 'utf8' });
  assert.equal(cli.status, 1);
  assert.match(cli.stdout, /1 mismatch/);
});

// design-freshness (UN-1): the design.md the Engineer and QA read indexes the round the state names.
const fresh = (dir, round) => designFreshness(dir, round).map((f) => f.msg).join('\n');

test('design-freshness: a design.md on the named round passes', () => assert.equal(fresh(build(), 2), ''));

test('design-freshness: a design.md indexing an older round fails', () => {
  const d = DESIGN.replace('Design round: 2', 'Design round: 1');
  assert.match(fresh(build({ design: d }), 2), /indexes design round 1; the state file names round 2/);
});

test('design-freshness: frame rows left on the old round fail, even under a fresh header', () => {
  const d = DESIGN.replace('| invoice list | default | wide | 2 |', '| invoice list | default | wide | 1 |');
  assert.match(fresh(build({ design: d }), 2), /1 row\(s\) not on round 2: "invoice list" default wide \(round 1\)/);
});

test('design-freshness: no header, no Round column or no named round fails rather than passes', () => {
  assert.match(fresh(build({ design: DESIGN.replace(/^Design round:.*\n/m, '') }), 2), /no "Design round: <n>" line/);
  const noCol = DESIGN.replace(/\| Round \|/, '|').replace('|---|---|---|---|---|---|', '|---|---|---|---|---|').replace(/\| wide \| 2 \|/g, '| wide |');
  assert.match(fresh(build({ design: noCol }), 2), /frame index has no Round column/);
  assert.match(fresh(build(), null), /names no design round/);
});

test('design-freshness: the gate blocks a QA start on a stale design.md in a host', () => {
  const host = mkdtempSync(path.join(tmpdir(), 'squad-host-'));
  const squad = path.join(host, '.squad');
  cpSync(fileURLToPath(new URL('..', import.meta.url)), path.join(squad, 'checks'), { recursive: true });
  mkdirSync(path.join(squad, 'state'), { recursive: true });
  mkdirSync(path.join(squad, 'builds'), { recursive: true });
  cpSync(build({ design: DESIGN.replace('Design round: 2', 'Design round: 1') }), path.join(squad, 'builds', 'demo'), { recursive: true });
  const state = path.join(squad, 'state', 'demo.md');
  writeFileSync(state, 'build: demo\ndesign-round: 2 (Figma demo file, landed 2026-11-18)\nstage-4-qa: pending\nwaived: none\n');
  const call = { tool_name: 'Edit', tool_input: { file_path: state, old_string: 'stage-4-qa: pending', new_string: 'stage-4-qa: running' } };
  const r = spawnSync('node', [path.join(squad, 'checks', 'hook.mjs')], { input: JSON.stringify(call), encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /\[design-freshness\] stage-4-qa cannot start: design.md indexes design round 1/);
  const cli = spawnSync('node', [path.join(squad, 'checks', 'consistency.mjs'), path.join(squad, 'builds', 'demo')], { encoding: 'utf8' });
  assert.equal(cli.status, 1);
  assert.match(cli.stdout, /indexes design round 1/);
});
