// The squad's blocking checks (v0.4). Pure functions: hook.mjs feeds them file contents and the
// command, and they return a list of failures. Each failure names its check id, so a waiver can
// name it too. Why each check exists is in LEARNINGS.md, under the ID in its comment.

export const CHECKS = ['state-lint', 'figure-gate', 'consistency-gate', 'design-freshness', 'amendment-gate', 'commit-guard', 'waiver-guard'];

const STATUSES = ['idle', 'pending', 'running', 'loop', 'done', 'halted', 'skipped'];
const TOP_KEYS = new Set(['build', 'mode', 'started', 'design-round', 'standing', 'escalations', 'waived']);
const FREE_TEXT = new Set(['build', 'mode', 'started', 'standing', 'escalations', 'waived']);
const TREE_WRITERS = new Set(['stage-3-engineer', 'stage-4-qa']);

// ---------------------------------------------------------------------------------------------
// Parsing the state file

// Returns { stages: [{ set, name, value, line }], waivers: [{ check, reason, line }], round, errors }.
// `round` is the design-round line, { value, line }, or null when the file has none.
// `set` is null for the main block, or the amendment set's header, e.g. "amendment-set-2".
export function parseState(text) {
  const stages = [];
  const waivers = [];
  const errors = [];
  let round = null;
  let set = null;
  let freeKey = null; // the free-text key a continuation line belongs to
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const n = i + 1;
    if (/^\s*$/.test(raw) || /^\s*```/.test(raw) || /^\s*#/.test(raw)) continue;
    const indented = /^\s+/.test(raw);
    const m = raw.match(/^\s*([a-z][a-z0-9.\-]*)(\s*\([^)]*\))?:\s*(.*)$/);

    if (!indented) {
      set = null;
      freeKey = null;
      if (!m) {
        errors.push({ line: n, msg: `not a "key: value" line: ${raw.trim()}` });
        continue;
      }
      const key = m[1];
      const value = m[3].trim();
      if (/^amendment-set-\d+$/.test(key)) {
        if (value !== '') errors.push({ line: n, msg: `${key} header takes no value` });
        set = key;
        continue;
      }
      if (TOP_KEYS.has(key)) {
        if (FREE_TEXT.has(key)) freeKey = key;
        if (key === 'waived' && value && value !== 'none') waivers.push(parseWaiver(value, n));
        if (key === 'design-round') round = { value, line: n };
        continue;
      }
      if (/^stage-[0-9.a-z]+-[a-z0-9-]+$/.test(key)) {
        stages.push({ set: null, name: key, value, line: n });
        continue;
      }
      errors.push({ line: n, msg: `unknown key "${key}"` });
      continue;
    }

    // Indented: a line inside an amendment set, or a continuation of a free-text key.
    if (set && m && (/^stage-/.test(m[1]) || m[1] === 'figure-check')) {
      stages.push({ set, name: m[1], value: m[3].trim(), line: n });
      continue;
    }
    if (freeKey) {
      if (freeKey === 'waived') waivers.push(parseWaiver(raw.trim(), n));
      continue;
    }
    errors.push({ line: n, msg: `indented line outside an amendment set or free-text field: ${raw.trim()}` });
  }
  return { stages, waivers, round, errors };
}

function parseWaiver(text, line) {
  const [check, ...rest] = text.split(/\s+/);
  return { check, reason: rest.join(' ').trim(), line };
}

// The design round a state file names: its number, or null when the line is absent or still "—".
export function designRound(text) {
  const r = parseState(text || '').round;
  const m = r && r.value.match(/^(\d+)\b/);
  return m ? Number(m[1]) : null;
}

export function statusOf(value) {
  const m = value.match(/^(idle|pending|running|loop|done|halted|skipped)\b/);
  return m ? m[1] : null;
}

// ---------------------------------------------------------------------------------------------
// state-lint (B3-13, status vocabulary in state/tasks.md)

export function lintState(text) {
  const { stages, waivers, round, errors } = parseState(text);
  const out = errors.map((e) => fail('state-lint', `line ${e.line}: ${e.msg}`));
  if (round && !/^(—|none|\d+(\s+\([^)]+\))?)$/.test(round.value)) {
    out.push(fail('state-lint', `line ${round.line}: design-round is "—" or "<n> (<where the frames are>, landed <date>)"`));
  }
  for (const s of stages) {
    const where = `line ${s.line} (${s.set ? s.set + ' ' : ''}${s.name})`;
    const st = statusOf(s.value);
    if (!st) {
      out.push(fail('state-lint', `${where}: "${s.value}" is not one of ${STATUSES.join(', ')}`));
      continue;
    }
    const bracket = /\([^)]+\)/.test(s.value);
    if (st === 'done' && !/\([^)]*\/[^)]*\)/.test(s.value)) {
      out.push(fail('state-lint', `${where}: a done needs its output path in brackets`));
    }
    if ((st === 'halted' || st === 'skipped') && !bracket) {
      out.push(fail('state-lint', `${where}: ${st} needs a reason in brackets`));
    }
    if (st === 'loop') {
      const lm = s.value.match(/^loop (\d+)\/(\d+)\b/);
      if (!lm) out.push(fail('state-lint', `${where}: a loop is written "loop n/N"`));
      else if (Number(lm[1]) > Number(lm[2]) || Number(lm[1]) < 1) {
        out.push(fail('state-lint', `${where}: loop ${lm[1]}/${lm[2]} is past its cap; that is a halt`));
      }
    }
  }
  for (const w of waivers) {
    if (!CHECKS.includes(w.check) || !w.reason) {
      out.push(fail('state-lint', `line ${w.line}: a waiver is "waived: <check> <reason>", check one of ${CHECKS.join(', ')}`));
    }
  }
  const writers = stages.filter((s) => TREE_WRITERS.has(s.name) && isActive(s.value));
  if (writers.length > 1) {
    out.push(fail('state-lint', `${writers.map((s) => (s.set ? s.set + ' ' : '') + s.name).join(' and ')} are both active; at most one stage writes the tree under test (B3-15)`));
  }
  return out;
}

const isActive = (v) => ['running', 'loop'].includes(statusOf(v));

// ---------------------------------------------------------------------------------------------
// figure-gate (WS-1): no Designer starts while its figure check is open or the deck has a
// [NEEDS SOURCE] figure. Fires only on the transition into running, so unrelated edits pass.

export function figureGate(before, after, copyDeck) {
  const prev = parseState(before || '').stages;
  const next = parseState(after).stages;
  const out = [];
  for (const s of next) {
    if (s.name !== 'stage-2-designer' || statusOf(s.value) !== 'running') continue;
    const was = prev.find((p) => p.set === s.set && p.name === s.name);
    if (was && statusOf(was.value) === 'running') continue;
    const checkName = s.set ? 'figure-check' : 'stage-1.5-figure-check';
    const fc = next.find((p) => p.set === s.set && p.name === checkName);
    const where = s.set ? `${s.set} ` : '';
    if (fc && !['done', 'skipped'].includes(statusOf(fc.value))) {
      out.push(fail('figure-gate', `${where}stage-2-designer cannot start: ${checkName} is "${fc.value}", not done (WS-1)`));
    }
    if (copyDeck && /\[NEEDS SOURCE\]/.test(copyDeck)) {
      out.push(fail('figure-gate', `${where}stage-2-designer cannot start: copy.md still carries a [NEEDS SOURCE] figure (WS-1)`));
    }
  }
  return out;
}

// The stage lines named `stage` that this edit moves into running. The hook runs the consistency
// and freshness checks only then, so they cost nothing on any other edit.
export function starting(before, after, stage) {
  const prev = parseState(before || '').stages;
  return parseState(after).stages.filter((s) => {
    if (s.name !== stage || statusOf(s.value) !== 'running') return false;
    const was = prev.find((p) => p.set === s.set && p.name === s.name);
    return !was || statusOf(was.value) !== 'running';
  });
}

// consistency-gate (B3-21): an Engineer line moving into running.
export const startsEngineer = (before, after) => starting(before, after, 'stage-3-engineer').length > 0;

// design-freshness (UN-1), the state-file half: a new design round lands only with its re-index
// queued, and never under a stage building or testing from the old one. The design.md half is
// designFreshness() in consistency.mjs, run when an Engineer or QA line starts.
export function designRoundGate(before, after) {
  const was = designRound(before);
  const now = designRound(after);
  if (was !== null && now === null) {
    return [fail('design-freshness', `design-round ${was} cannot be cleared. A new round replaces it with its own number (UN-1)`)];
  }
  if (was === null || was === now) return [];
  const { stages } = parseState(after);
  const out = [];
  const active = stages.filter((s) => TREE_WRITERS.has(s.name) && isActive(s.value));
  if (active.length) {
    out.push(fail('design-freshness', `design round ${now} cannot land while ${active.map((s) => (s.set ? s.set + ' ' : '') + s.name).join(' and ')} is building from round ${was}. Halt it first, "halted (design round ${now} landed)", then re-index (UN-1)`));
  }
  if (!stages.some((s) => s.name === 'stage-2-designer' && ['pending', 'running'].includes(statusOf(s.value)))) {
    out.push(fail('design-freshness', `design round ${now} landed with no Designer line pending or running. Queue the re-index in the same edit: "stage-2-designer: pending (re-index round ${now})" (UN-1)`));
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// waiver-guard: only Joel adds a waiver, by editing the state file outside Claude.

export function waiverGuard(before, after) {
  const count = (t) => parseState(t || '').waivers.length;
  return count(after) > count(before)
    ? [fail('waiver-guard', 'an agent cannot add a waived: line. Only Joel waives a check, on github.com')]
    : [];
}

// ---------------------------------------------------------------------------------------------
// Bash checks

// Split a shell command into simple commands on ; && || | and newlines. Good enough for the
// command shapes agents write; anything cleverer is refused by the git guard or reviewed in logs.
export function simpleCommands(cmd) {
  return cmd
    .split(/\n|;|&&|\|\||\|/)
    .map((c) => c.trim())
    .filter(Boolean);
}

function gitVerb(c) {
  const m = c.match(/^((?:[A-Z_][A-Z0-9_]*=\S*\s+)*)git\s+((?:-[Cc]\s+\S+\s+|--[a-z-]+(?:=\S+)?\s+)*)([a-z-]+)(.*)$/);
  return m ? { env: m[1], verb: m[3], rest: m[4].trim() } : null;
}

// amendment-gate (B3-2, B3-11): nothing reaches the production branch while an amendment set has
// a line that is not done.
export function amendmentGate(cmd, states, currentBranch) {
  const open = [];
  for (const [file, text] of states) {
    for (const s of parseState(text).stages) {
      if (s.set && !['done', 'skipped'].includes(statusOf(s.value))) open.push(`${file}: ${s.set} ${s.name} ${s.value}`);
    }
  }
  if (!open.length) return [];
  const prod = /^(main|master|production)$/;
  for (const c of simpleCommands(cmd)) {
    const g = gitVerb(c);
    let hit = false;
    if (g && g.verb === 'push') {
      const args = g.rest.split(/\s+/).filter((a) => a && !a.startsWith('-'));
      const refs = args.slice(1);
      if (refs.length === 0) hit = prod.test(currentBranch || '');
      else hit = refs.some((r) => prod.test(r.split(':').pop().replace(/^refs\/heads\//, '')) || (r === 'HEAD' && prod.test(currentBranch || '')));
    }
    if (/^gh\s+pr\s+merge\b/.test(c)) hit = true;
    if (hit) {
      return [fail('amendment-gate', `"${c}" would reach the production branch while an amendment set is unbuilt (B3-2):\n  ${open.join('\n  ')}`)];
    }
  }
  return [];
}

// commit-guard (B3-15): while a stage that writes the tree is active, a commit must declare it is
// that stage's own, as SQUAD_STAGE=<stage> git commit ...
export function commitGuard(cmd, states) {
  const active = [];
  for (const [, text] of states) {
    for (const s of parseState(text).stages) if (TREE_WRITERS.has(s.name) && isActive(s.value)) active.push(s.name);
  }
  if (!active.length) return [];
  for (const c of simpleCommands(cmd)) {
    const g = gitVerb(c);
    if (!g || g.verb !== 'commit') continue;
    const declared = (g.env.match(/SQUAD_STAGE=(\S+)/) || [])[1];
    if (!declared || !active.includes(declared)) {
      return [fail('commit-guard', `${active.join(', ')} is writing the tree. Only that stage commits now, as "SQUAD_STAGE=${active[0]} git commit ..." (B3-15)`)];
    }
  }
  return [];
}

// A Bash command that writes a live state file bypasses the lint, so it is refused: state edits go
// through the Edit and Write tools, which also refuse an anchor that matches twice (B3-13).
export function bashWritesState(cmd, stateRel) {
  if (!stateRel.some((p) => cmd.includes(p))) return [];
  const writes = /(^|[^0-9&>])>{1,2}(?!&)|\bsed\s+(-[a-zA-Z]*\s+)*-i|\btee\b|\bperl\s+-[a-zA-Z]*i|\bpython3?\b|\bnode\b|\bmv\b|\bcp\b|\btruncate\b|\bawk\b.*-i\s+inplace/;
  const hit = simpleCommands(cmd).some((c) => stateRel.some((p) => c.includes(p)) && writes.test(c));
  return hit ? [fail('state-lint', 'edit a state file with the Edit or Write tool, never from Bash, so the state lint sees the change (B3-13)')] : [];
}

export function bashAddsWaiver(cmd, stateRel) {
  return /waived:/.test(cmd) && stateRel.some((p) => cmd.includes(p))
    ? [fail('waiver-guard', 'an agent cannot add a waived: line. Only Joel waives a check, on github.com')]
    : [];
}

// ---------------------------------------------------------------------------------------------

export function applyWaivers(failures, stateText) {
  const waived = new Set(parseState(stateText || '').waivers.map((w) => w.check));
  // A waiver never covers the guard on waivers themselves.
  return failures.filter((f) => f.check === 'waiver-guard' || !waived.has(f.check));
}

function fail(check, msg) {
  return { check, msg };
}
