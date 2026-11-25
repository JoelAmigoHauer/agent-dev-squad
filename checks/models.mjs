// The model table (v0.4): which Claude model each role runs on. This file binds the defaults, the
// tier order and which stage line each role owns. The idle block in state/tasks.md, the subagent
// definitions in subagents/ and the table in CLAUDE.md *Models* repeat the defaults, and a test
// fails when any of them disagrees with this file.
//
// One tier runs on the most capable model: the Orchestrator, which plans, routes and reviews every
// stage's output at its gate. Every stage subagent runs a tier below. Claude Fable 5.2 is the most
// capable model (Claude docs, *Models overview*: "for demanding reasoning and long-horizon agentic
// work", read 2026-11-25), so `fable` is the top tier.
//
// Values are Claude Code's model aliases, because the Agent tool's per-invocation `model` takes an
// alias and nothing else, and the per-invocation value outranks a subagent's own frontmatter
// (Claude Code docs, *Subagents*, "Choose a model", read 2026-11-25). As at 2026-11-25 the aliases
// resolve to claude-fable-5-2, claude-opus-5-5, claude-sonnet-5-5 and claude-haiku-5-5. Preflight
// records what each resolves to on the day, observed.

// Most capable first.
export const TIERS = ['fable', 'opus', 'sonnet', 'haiku'];
export const TOP = TIERS[0];

export const DEFAULTS = {
  orchestrator: 'fable',
  surveyor: 'sonnet',
  preflight: 'haiku',
  architect: 'opus',
  copywriter: 'sonnet',
  designer: 'sonnet',
  engineer: 'opus',
  qa: 'sonnet',
  security: 'opus',
  devops: 'sonnet',
  retro: 'sonnet',
};

export const ROLES = Object.keys(DEFAULTS);
// Every role but the Orchestrator fires as a subagent named squad-<role>.
export const SUBAGENT_ROLES = ROLES.filter((r) => r !== 'orchestrator');

// The stage line each role owns. The Orchestrator's own lines run in its context, never a subagent.
const LINE_ROLE = {
  'stage-0.25-surveyor': 'surveyor',
  'stage-0-intake': 'orchestrator',
  'stage-0.5-preflight': 'preflight',
  'stage-1-architect': 'architect',
  'stage-1.5-copywriter': 'copywriter',
  'stage-1.5-figure-check': 'orchestrator',
  'figure-check': 'orchestrator',
  'stage-2-designer': 'designer',
  'stage-3-engineer': 'engineer',
  'stage-4-qa': 'qa',
  'stage-5a-security': 'security',
  'stage-5b-security': 'security',
  'stage-6-deploy': 'devops',
  'stage-7-retro': 'retro',
};

export function roleOf(line) {
  return LINE_ROLE[line] ?? null;
}

// The `models:` block of the idle state block, as state/tasks.md carries it.
export function modelsBlock(models = DEFAULTS) {
  const w = Math.max(...Object.keys(models).map((r) => r.length)) + 2;
  return ['models:', ...Object.entries(models).map(([r, m]) => `  ${(r + ':').padEnd(w)}${m}`)].join('\n');
}

// The `model:` line of a subagent definition's frontmatter, or null.
export function frontmatterModel(text) {
  const fm = (text ?? '').match(/^---\n([\s\S]*?)\n---/);
  if (!fm) return null;
  const m = fm[1].match(/^model:\s*(\S+)\s*$/m);
  return m ? m[1] : null;
}
