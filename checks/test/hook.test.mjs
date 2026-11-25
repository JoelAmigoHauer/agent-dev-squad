// End to end: the hook as Claude Code runs it, in a stamped host layout (.squad/checks, .squad/state).
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, cpSync, writeFileSync } from 'node:fs';
import { spawnSync, execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CHECKS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let host, squad, stateFile;

const STATE = `build:               demo
mode:                greenfield
started:             2026-11-25T22:00
stage-1.5-figure-check: pending
stage-2-designer:    pending
stage-3-engineer:    running
standing:            none
waived:              none
escalations:         none
`;

before(() => {
  host = mkdtempSync(path.join(tmpdir(), 'squad-host-'));
  squad = path.join(host, '.squad');
  mkdirSync(path.join(squad, 'state'), { recursive: true });
  mkdirSync(path.join(squad, 'builds', 'demo'), { recursive: true });
  cpSync(CHECKS, path.join(squad, 'checks'), { recursive: true });
  stateFile = path.join(squad, 'state', 'demo.md');
  writeFileSync(stateFile, STATE);
  writeFileSync(path.join(squad, 'state', 'tasks.md'), 'template, never linted as live state\n');
  writeFileSync(path.join(squad, 'builds', 'demo', 'copy.md'), 'no marks\n');
  execFileSync('git', ['init', '-q', '-b', 'feature'], { cwd: host });
});

function hook(call) {
  const r = spawnSync('node', [path.join(squad, 'checks', 'hook.mjs')], { input: JSON.stringify({ cwd: host, ...call }), encoding: 'utf8' });
  return { code: r.status, err: r.stderr };
}

test('an unrelated tool call passes', () => {
  assert.equal(hook({ tool_name: 'Read', tool_input: { file_path: stateFile } }).code, 0);
  assert.equal(hook({ tool_name: 'Bash', tool_input: { command: 'ls' } }).code, 0);
});

test('an Edit that breaks the state file is blocked with exit 2', () => {
  const r = hook({ tool_name: 'Edit', tool_input: { file_path: stateFile, old_string: 'stage-2-designer:    pending', new_string: 'stage-2-designer: done' } });
  assert.equal(r.code, 2);
  assert.match(r.err, /\[state-lint\]/);
});

test('starting the Designer before the figure check is blocked', () => {
  const r = hook({ tool_name: 'Edit', tool_input: { file_path: stateFile, old_string: 'stage-2-designer:    pending', new_string: 'stage-2-designer: running' } });
  assert.equal(r.code, 2);
  assert.match(r.err, /\[figure-gate\]/);
});

test('editing tasks.md is never linted', () => {
  const r = hook({ tool_name: 'Write', tool_input: { file_path: path.join(squad, 'state', 'tasks.md'), content: 'anything: at all\n' } });
  assert.equal(r.code, 0);
});

test('an agent Write that adds a waiver is blocked', () => {
  const r = hook({ tool_name: 'Write', tool_input: { file_path: stateFile, content: STATE.replace('waived:              none', 'waived: figure-gate because') } });
  assert.equal(r.code, 2);
  assert.match(r.err, /\[waiver-guard\]/);
});

test('a commit under the running Engineer is blocked unless the Engineer declares it', () => {
  assert.equal(hook({ tool_name: 'Bash', tool_input: { command: 'git add a.ts && git commit -m "checkpoint"' } }).code, 2);
  assert.equal(hook({ tool_name: 'Bash', tool_input: { command: 'git add a.ts && SQUAD_STAGE=stage-3-engineer git commit -m "x"' } }).code, 0);
});

test('a waiver Joel wrote lifts its check', () => {
  writeFileSync(stateFile, STATE.replace('waived:              none', 'waived: figure-gate the deck regex misreads a table'));
  const r = hook({ tool_name: 'Edit', tool_input: { file_path: stateFile, old_string: 'stage-2-designer:    pending', new_string: 'stage-2-designer: running' } });
  assert.equal(r.code, 0, r.err);
  writeFileSync(stateFile, STATE);
});

// Preflight's liveness probe (agents/preflight.md, *Prove the checks are live*). Preflight runs
// exactly this command and counts the refusal as the pass, so the lint must always refuse it.
test('the Preflight liveness probe is refused', () => {
  const r = hook({ tool_name: 'Bash', tool_input: { command: 'test -f .squad/state/demo.md > /dev/null' } });
  assert.equal(r.code, 2);
  assert.match(r.err, /\[state-lint\]/);
});
