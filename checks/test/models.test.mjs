// The model table (checks/models.mjs): its defaults, the copies that repeat them, the state lint's
// rules for the models: block, and model-guard on the Agent call.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { DEFAULTS, TIERS, TOP, ROLES, SUBAGENT_ROLES, roleOf, modelsBlock, frontmatterModel } from '../models.mjs';
import { lintState, modelGuard, parseState, CHECKS } from '../lib.mjs';
import { tableAfter } from '../md.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(path.join(ROOT, p), 'utf8');
const checks = (fs) => fs.map((f) => f.check);

const BASE = `build:               demo
mode:                greenfield
stage-0.5-preflight: pending
stage-3-engineer:    pending
${modelsBlock()}
standing:            none
waived:              none
escalations:         none
`;
const row = (role, model) => BASE.replace(new RegExp(`^(  ${role}:\\s+)\\S+$`, 'm'), `$1${model}`);

// ---------------------------------------------------------------------------------------------
// The defaults, and every copy of them

test('exactly one role runs on the top tier, and it is the Orchestrator', () => {
  assert.equal(TOP, 'fable');
  assert.deepEqual(ROLES.filter((r) => DEFAULTS[r] === TOP), ['orchestrator']);
  for (const r of ROLES) assert.ok(TIERS.includes(DEFAULTS[r]), `${r}: ${DEFAULTS[r]}`);
});

test('every stage role has a subagent definition carrying its default model', () => {
  const files = readdirSync(path.join(ROOT, 'subagents')).filter((f) => f.endsWith('.md')).sort();
  assert.deepEqual(files, SUBAGENT_ROLES.map((r) => `squad-${r}.md`).sort(), 'one definition per stage role, no more');
  for (const r of SUBAGENT_ROLES) {
    const text = read(`subagents/squad-${r}.md`);
    assert.match(text, new RegExp(`^name: squad-${r}$`, 'm'), `${r}: name`);
    assert.equal(frontmatterModel(text), DEFAULTS[r], `subagents/squad-${r}.md model`);
  }
});

test('the idle block in state/tasks.md carries the defaults', () => {
  const tasks = read('state/tasks.md');
  const idle = tasks.match(/## Idle block[\s\S]*?```\n([\s\S]*?)```/)[1];
  const { models } = parseState(idle);
  assert.ok(models, 'the idle block has a models: block');
  assert.deepEqual(Object.fromEntries(Object.entries(models).map(([r, m]) => [r, m.value])), DEFAULTS);
});

test('every stage line in the idle block belongs to a role', () => {
  const idle = read('state/tasks.md').match(/## Idle block[\s\S]*?```\n([\s\S]*?)```/)[1];
  for (const s of parseState(idle).stages) assert.ok(ROLES.includes(roleOf(s.name)), s.name);
});

test("CLAUDE.md's Models table carries the defaults", () => {
  const rows = tableAfter(read('CLAUDE.md'), /^##\s+Models$/);
  assert.deepEqual(Object.fromEntries(rows.map((r) => [r.role, r.model])), DEFAULTS);
  assert.ok(CHECKS.includes('model-guard'));
  assert.match(read('CLAUDE.md'), /^\| `model-guard` \|/m, 'the Checks table names model-guard');
});

test('/squad init stamps the definitions and registers the hook on the Agent call', () => {
  const skill = read('.claude/skills/squad/SKILL.md');
  assert.match(skill, /cp "\$TMP"\/subagents\/squad-\*\.md \.claude\/agents\//);
  assert.match(skill, /matcher: "Bash\|Edit\|Write\|MultiEdit\|Agent\|Task"/);
  assert.match(skill, /s\.model \?\?= "fable"/);
});

// ---------------------------------------------------------------------------------------------
// state-lint and model-guard on the models: block

test('the default models block passes the lint', () => assert.deepEqual(lintState(BASE), []));

test('a stage on the top tier, or the Orchestrator off it, is refused by model-guard', () => {
  assert.deepEqual(checks(lintState(row('engineer', 'fable'))), ['model-guard']);
  assert.deepEqual(checks(lintState(row('orchestrator', 'opus'))), ['model-guard']);
  assert.deepEqual(lintState(row('engineer', 'sonnet')), [], 'a stage moved between lower tiers passes');
});

test('an unknown model, an unknown role, a missing row and a repeated row fail the lint', () => {
  assert.deepEqual(checks(lintState(row('qa', 'gpt'))), ['state-lint']);
  assert.deepEqual(checks(lintState(row('qa', 'claude-sonnet-5-5'))), ['state-lint'], 'aliases only: the Agent call takes nothing else');
  assert.deepEqual(checks(lintState(BASE.replace('  retro:', '  janitor:'))), ['state-lint', 'state-lint']);
  assert.deepEqual(checks(lintState(BASE.replace(/^ {2}retro:.*\n/m, ''))), ['state-lint']);
  assert.deepEqual(checks(lintState(BASE.replace('  retro:', '  qa:      sonnet\n  retro:'))), ['state-lint']);
  assert.deepEqual(checks(lintState(BASE.replace('models:', 'models: fable'))), ['state-lint']);
});

// ---------------------------------------------------------------------------------------------
// model-guard on the Agent call

const LIVE = [['state/demo.md', BASE]];

test('model-guard: a stage fired by its definition with its row passes', () => {
  assert.deepEqual(modelGuard({ subagent_type: 'squad-engineer', model: 'opus', prompt: 'x' }, LIVE), []);
  assert.deepEqual(modelGuard({ subagent_type: 'squad-preflight', model: 'haiku' }, LIVE), []);
  assert.deepEqual(modelGuard({ subagent_type: 'squad-engineer', model: 'sonnet' }, [['state/demo.md', row('engineer', 'sonnet')]]), []);
});

test('model-guard: a stage fired without its row, or with another, is refused', () => {
  assert.deepEqual(checks(modelGuard({ subagent_type: 'squad-engineer' }, LIVE)), ['model-guard']);
  assert.deepEqual(checks(modelGuard({ subagent_type: 'squad-engineer', model: 'fable' }, LIVE)), ['model-guard']);
  assert.deepEqual(checks(modelGuard({ subagent_type: 'squad-qa', model: 'opus' }, LIVE)), ['model-guard']);
});

test('model-guard: while a build is live, no subagent runs outside the table', () => {
  for (const t of ['general-purpose', 'fork', 'Explore', undefined, 'squad-orchestrator', 'squad-janitor']) {
    assert.deepEqual(checks(modelGuard({ subagent_type: t, model: 'sonnet' }, LIVE)), ['model-guard'], String(t));
  }
  // The Orchestrator is the session, never a subagent, even fired on its own row.
  assert.match(modelGuard({ subagent_type: 'squad-orchestrator', model: 'fable' }, LIVE)[0]?.msg ?? '', /every subagent is a stage/);
});

test('model-guard: a state file with no models block refuses every stage fire', () => {
  const old = BASE.replace(/models:\n( {2}.*\n)+/, '');
  assert.deepEqual(checks(modelGuard({ subagent_type: 'squad-qa', model: 'sonnet' }, [['state/demo.md', old]])), ['model-guard']);
});

test('model-guard: with no build live, any subagent passes', () => {
  assert.deepEqual(modelGuard({ subagent_type: 'general-purpose' }, []), []);
});
