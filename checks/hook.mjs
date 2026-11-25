#!/usr/bin/env node
// squad checks: a Claude Code PreToolUse hook for Bash, Edit, Write and MultiEdit (v0.4).
// /squad init registers it in the host's .claude/settings.json. It reads the tool call on stdin,
// runs the checks in lib.mjs, and exits 2 with the reasons on stderr to block the call.
// A failing check blocks, with no bypass. Only Joel can waive one, per build, by adding
// "waived: <check> <reason>" to the build's state file on github.com.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  lintState, figureGate, waiverGuard, amendmentGate, commitGuard,
  bashWritesState, bashAddsWaiver, applyWaivers,
} from './lib.mjs';

// The pipeline root: .squad/ in a host repo, the repo root in the template.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STATE_DIR = path.join(ROOT, 'state');

const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : null);

function liveStateFiles() {
  if (!existsSync(STATE_DIR)) return [];
  return readdirSync(STATE_DIR)
    .filter((f) => f.endsWith('.md') && f !== 'tasks.md')
    .map((f) => path.join(STATE_DIR, f));
}

function isLiveState(p) {
  const abs = path.resolve(p);
  return path.dirname(abs) === STATE_DIR && abs.endsWith('.md') && path.basename(abs) !== 'tasks.md';
}

function copyDeckFor(stateText) {
  const m = stateText.match(/^build:\s*(\S+)/m);
  return m ? read(path.join(ROOT, 'builds', m[1], 'copy.md')) : null;
}

function afterEdit(before, input) {
  let text = before ?? '';
  const edits = input.edits ?? [{ old_string: input.old_string, new_string: input.new_string, replace_all: input.replace_all }];
  for (const e of edits) {
    if (e.old_string === undefined) continue;
    if (!text.includes(e.old_string)) return null; // the Edit tool will refuse it anyway
    text = e.replace_all ? text.split(e.old_string).join(e.new_string) : text.replace(e.old_string, () => e.new_string);
  }
  return text;
}

function currentBranch(cwd) {
  try {
    return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

export function run(call) {
  const tool = call.tool_name;
  const input = call.tool_input ?? {};
  const states = liveStateFiles().map((f) => [path.relative(ROOT, f), read(f)]);
  const allWaivers = states.map(([, t]) => t).join('\n');
  let failures = [];
  let waiverText = '';

  if ((tool === 'Edit' || tool === 'Write' || tool === 'MultiEdit') && input.file_path && isLiveState(input.file_path)) {
    const before = read(path.resolve(input.file_path));
    const after = tool === 'Write' ? input.content ?? '' : afterEdit(before, input);
    if (after === null) return [];
    failures = [
      ...waiverGuard(before, after),
      ...lintState(after),
      ...figureGate(before, after, copyDeckFor(after)),
    ];
    waiverText = before ?? '';
  } else if (tool === 'Bash' && typeof input.command === 'string') {
    const cmd = input.command;
    const relPaths = liveStateFiles().map((f) => `state/${path.basename(f)}`);
    failures = [
      ...bashAddsWaiver(cmd, relPaths),
      ...bashWritesState(cmd, relPaths),
      ...amendmentGate(cmd, states, currentBranch(call.cwd || process.cwd())),
      ...commitGuard(cmd, states),
    ];
    waiverText = allWaivers;
  }
  return applyWaivers(failures, waiverText);
}

function main() {
  let call;
  try {
    call = JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    process.exit(0); // not a tool call this hook understands
  }
  const failures = run(call);
  if (!failures.length) process.exit(0);
  process.stderr.write(
    'BLOCKED by the squad checks.\n' +
      failures.map((f) => `- [${f.check}] ${f.msg}`).join('\n') +
      '\n\nThere is no bypass. Record the block in the build\'s log.md and stop; the Orchestrator ' +
      'escalates it. If the check itself is wrong, log it cause: test-defect: only Joel can waive it, ' +
      'by adding "waived: <check> <reason>" to the state file on github.com. If he has, git pull and retry.\n',
  );
  process.exit(2);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
