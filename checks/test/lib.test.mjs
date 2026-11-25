import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  lintState, figureGate, waiverGuard, amendmentGate, commitGuard,
  bashWritesState, bashAddsWaiver, applyWaivers, designRoundGate, designRound,
} from '../lib.mjs';

const checks = (fs) => fs.map((f) => f.check);

const IDLE = `build:               demo
mode:                greenfield
started:             2026-11-25T22:00
stage-0.25-surveyor: skipped (greenfield)
stage-0.5-preflight: done    (/builds/demo/preflight.md)
stage-1-architect:   done    (/builds/demo/contract/)
stage-1.5-copywriter: done   (/builds/demo/copy.md)
stage-1.5-figure-check: pending
stage-2-designer:    pending
stage-3-engineer:    pending
stage-4-qa:          pending
standing:            none
waived:              none
escalations:         2026-11-25T22:10 stage-1-architect resolved
                     2026-11-25T22:20 stage-1-architect second line
`;

// The template's own idle block and worked example must pass, or the shape drifted (B3-13).
test('state/tasks.md blocks pass the lint', () => {
  const tasks = readFileSync(fileURLToPath(new URL('../../state/tasks.md', import.meta.url)), 'utf8');
  const blocks = [...tasks.matchAll(/```\n([\s\S]*?)```/g)].map((m) => m[1]).filter((b) => /^build:/m.test(b));
  assert.equal(blocks.length, 2, 'idle block and worked example');
  for (const b of blocks) assert.deepEqual(lintState(b), []);
});

test('state-lint: a valid file passes', () => assert.deepEqual(lintState(IDLE), []));

test('state-lint: done without a path fails', () => {
  const t = IDLE.replace('done    (/builds/demo/preflight.md)', 'done    (mode B)');
  assert.deepEqual(checks(lintState(t)), ['state-lint']);
});

test('state-lint: halted and skipped need a reason', () => {
  assert.deepEqual(checks(lintState(IDLE.replace('skipped (greenfield)', 'skipped'))), ['state-lint']);
  assert.deepEqual(checks(lintState(IDLE.replace('stage-3-engineer:    pending', 'stage-3-engineer: halted'))), ['state-lint']);
});

test('state-lint: unknown status, unknown key, bad loop', () => {
  assert.deepEqual(checks(lintState(IDLE.replace('stage-4-qa:          pending', 'stage-4-qa: working'))), ['state-lint']);
  assert.deepEqual(checks(lintState(IDLE + 'notes: something\n')), ['state-lint']);
  assert.deepEqual(checks(lintState(IDLE.replace('stage-4-qa:          pending', 'stage-4-qa: loop 4/3'))), ['state-lint']);
  assert.deepEqual(lintState(IDLE.replace('stage-4-qa:          pending', 'stage-4-qa: loop 3/3 (detail in log.md)')), []);
});

test('state-lint: Engineer and QA both active fails (B3-15)', () => {
  const t = IDLE.replace('stage-3-engineer:    pending', 'stage-3-engineer: running').replace('stage-4-qa:          pending', 'stage-4-qa: loop 1/3');
  assert.deepEqual(checks(lintState(t)), ['state-lint']);
});

test('state-lint: amendment set lines are linted', () => {
  const ok = IDLE + 'amendment-set-1 (A1–A3):\n  stage-3-engineer: pending\n  figure-check: done (/builds/demo/log.md)\n';
  assert.deepEqual(lintState(ok), []);
  assert.deepEqual(checks(lintState(ok.replace('figure-check: done (/builds/demo/log.md)', 'figure-check: done'))), ['state-lint']);
});

test('state-lint: a malformed waiver fails', () => {
  assert.deepEqual(checks(lintState(IDLE.replace('waived:              none', 'waived: figure-gate'))), ['state-lint']);
  assert.deepEqual(checks(lintState(IDLE.replace('waived:              none', 'waived: no-such-check reason'))), ['state-lint']);
  assert.deepEqual(lintState(IDLE.replace('waived:              none', 'waived: figure-gate the deck regex misreads a table')), []);
});

test('figure-gate: Designer cannot start while the figure check is open', () => {
  const after = IDLE.replace('stage-2-designer:    pending', 'stage-2-designer: running');
  assert.deepEqual(checks(figureGate(IDLE, after, '')), ['figure-gate']);
  const cleared = after.replace('stage-1.5-figure-check: pending', 'stage-1.5-figure-check: done (/builds/demo/log.md)');
  assert.deepEqual(figureGate(IDLE, cleared, 'no marks'), []);
});

test('figure-gate: Designer cannot start while the deck has [NEEDS SOURCE]', () => {
  const after = IDLE.replace('stage-1.5-figure-check: pending', 'stage-1.5-figure-check: done (/builds/demo/log.md)')
    .replace('stage-2-designer:    pending', 'stage-2-designer: running');
  assert.deepEqual(checks(figureGate(IDLE, after, 'Saves 40% [NEEDS SOURCE]')), ['figure-gate']);
});

test('figure-gate: an amendment set uses its own figure-check line', () => {
  const base = IDLE + 'amendment-set-1 (A1):\n  figure-check: pending\n  stage-2-designer: pending\n';
  const after = base.replace('  stage-2-designer: pending', '  stage-2-designer: running');
  assert.deepEqual(checks(figureGate(base, after, '')), ['figure-gate']);
});

test('figure-gate: an edit that leaves a running Designer alone passes', () => {
  const running = IDLE.replace('stage-2-designer:    pending', 'stage-2-designer: running');
  assert.deepEqual(figureGate(running, running.replace('stage-4-qa:          pending', 'stage-4-qa: pending'), ''), []);
});

test('waiver-guard: adding a waiver is refused, keeping one is not', () => {
  const w = IDLE.replace('waived:              none', 'waived: figure-gate reason');
  assert.deepEqual(checks(waiverGuard(IDLE, w)), ['waiver-guard']);
  assert.deepEqual(waiverGuard(w, w.replace('stage-4-qa:          pending', 'stage-4-qa: running')), []);
});

const OPEN = [['state/demo.md', IDLE + 'amendment-set-2 (A4):\n  stage-3-engineer: pending\n']];

test('amendment-gate: push to main is refused while a set is unbuilt (B3-2)', () => {
  assert.deepEqual(checks(amendmentGate('git push origin main', OPEN, 'feature')), ['amendment-gate']);
  assert.deepEqual(checks(amendmentGate('git add x && git push', OPEN, 'main')), ['amendment-gate']);
  assert.deepEqual(checks(amendmentGate('git push origin HEAD:refs/heads/main', OPEN, 'feature')), ['amendment-gate']);
  assert.deepEqual(checks(amendmentGate('gh pr merge 12 --squash', OPEN, 'feature')), ['amendment-gate']);
});

test('amendment-gate: feature pushes, and pushes with every set built, pass', () => {
  assert.deepEqual(amendmentGate('git push -u origin feature', OPEN, 'feature'), []);
  const built = [['state/demo.md', IDLE + 'amendment-set-2 (A4):\n  stage-3-engineer: done (/builds/demo/build-notes.md)\n']];
  assert.deepEqual(amendmentGate('git push origin main', built, 'main'), []);
});

const ENGINEER = [['state/demo.md', IDLE.replace('stage-3-engineer:    pending', 'stage-3-engineer: running')]];

test('commit-guard: no commit under a running Engineer unless it is the Engineer (B3-15)', () => {
  assert.deepEqual(checks(commitGuard('git add a.ts && git commit -m "x"', ENGINEER)), ['commit-guard']);
  assert.deepEqual(checks(commitGuard('SQUAD_STAGE=stage-4-qa git commit -m x', ENGINEER)), ['commit-guard']);
  assert.deepEqual(commitGuard('git add a.ts && SQUAD_STAGE=stage-3-engineer git commit -m "x"', ENGINEER), []);
  assert.deepEqual(commitGuard('git commit -m "x"', [['state/demo.md', IDLE]]), []);
});

test('bash writes to a state file are refused, reads are not', () => {
  const p = ['state/demo.md'];
  assert.deepEqual(checks(bashWritesState("sed -i 's/a/b/' .squad/state/demo.md", p)), ['state-lint']);
  assert.deepEqual(checks(bashWritesState('echo x >> .squad/state/demo.md', p)), ['state-lint']);
  assert.deepEqual(bashWritesState('cat .squad/state/demo.md', p), []);
  assert.deepEqual(bashWritesState('git add .squad/state/demo.md && git commit -m "state"', p), []);
  assert.deepEqual(checks(bashAddsWaiver('printf "waived: x y" > .squad/state/demo.md', p)), ['waiver-guard']);
});

test('a waiver lifts its own check, never the waiver guard', () => {
  const fs = [{ check: 'figure-gate', msg: '' }, { check: 'waiver-guard', msg: '' }];
  const w = IDLE.replace('waived:              none', 'waived: figure-gate reason\n  waiver-guard also');
  assert.deepEqual(checks(applyWaivers(fs, w)), ['waiver-guard']);
});

// design-freshness, the state-file half (UN-1).
const R1 = IDLE.replace('started:             2026-11-25T22:00', 'started:             2026-11-25T22:00\ndesign-round:        1 (Figma demo file, landed 2026-11-05)')
  .replace('stage-2-designer:    pending', 'stage-2-designer:    done    (/builds/demo/design.md)');

test('state-lint: design-round is "—" or a number with its source', () => {
  assert.deepEqual(lintState(R1), []);
  assert.deepEqual(lintState(R1.replace(/design-round: .*/, 'design-round: —')), []);
  assert.deepEqual(checks(lintState(R1.replace(/design-round: .*/, 'design-round: Round 2'))), ['state-lint']);
  assert.equal(designRound(R1), 1);
});

test('design-freshness: a new round lands only with its re-index queued', () => {
  const bare = R1.replace('1 (Figma demo file, landed 2026-11-05)', '2 (Figma demo file, landed 2026-11-18)');
  assert.deepEqual(checks(designRoundGate(R1, bare)), ['design-freshness']);
  const queued = bare.replace('stage-2-designer:    done    (/builds/demo/design.md)', 'stage-2-designer: pending (re-index round 2)');
  assert.deepEqual(designRoundGate(R1, queued), []);
});

test('design-freshness: a new round cannot land under a running Engineer, and cannot be cleared', () => {
  const running = R1.replace('stage-3-engineer:    pending', 'stage-3-engineer: running');
  const bumped = running.replace('1 (Figma demo file, landed 2026-11-05)', '2 (Figma demo file, landed 2026-11-18)')
    .replace('stage-2-designer:    done    (/builds/demo/design.md)', 'stage-2-designer: pending (re-index round 2)');
  assert.deepEqual(checks(designRoundGate(running, bumped)), ['design-freshness']);
  const halted = bumped.replace('stage-3-engineer: running', 'stage-3-engineer: halted (design round 2 landed)');
  assert.deepEqual(designRoundGate(running, halted), []);
  // With a Designer queued, only the clearing rule can refuse this edit.
  const queued = R1.replace('stage-2-designer:    done    (/builds/demo/design.md)', 'stage-2-designer: pending (re-index)');
  assert.match(designRoundGate(queued, queued.replace(/design-round: .*/, 'design-round: —')).map((f) => f.msg).join(''), /cannot be cleared/);
});

test('design-freshness: the first round, and edits that leave the round alone, pass', () => {
  assert.deepEqual(designRoundGate(R1.replace(/design-round: .*/, 'design-round: —'), R1), []);
  assert.deepEqual(designRoundGate(R1, R1.replace('stage-4-qa:          pending', 'stage-4-qa: running')), []);
});
