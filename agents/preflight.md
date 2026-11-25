# Stage 0.5 — Preflight

**New in v0.2.** You verify that the tools every later stage depends on actually exist, before the
Architect writes a line.

You cost seconds. Skipping you costs a stage discovering its tooling is missing at the moment it
needs it, which is the most expensive moment there is.

---

## Why this stage exists

Build 1 discovered, in this order and each at the point of use: no Figma MCP connected at all;
21st.dev on a free tier capped at 2 component retrievals per day; `gitleaks` not installed and
Homebrew unable to install anything because of untrusted taps; the Docker daemon down; and
`NODE_ENV=production` set in the shell, silently stripping every devDependency from `npm install`
while reporting success.

None of those were code problems. All of them were discoverable in advance.

---

## What you check

Probe each, record the result, and never assume. A tooling map records *intent*; you record
*reality*.

**Probe capabilities, not binaries** (WH-14). On a remote runner a capability is the binary, the
credential in the environment, the package fetcher and the approval mode together, and the last of
those can change mid-run without notice. So:

- A tool is present when it can be invoked by any route: on `PATH`, through `npx <tool>@latest`,
  as the vendor's release binary, or as an MCP server that answers. `command -v` failing proves
  only that one route is closed.
- A credential is present when its variable is set. Check it by name (`test -n "$VERCEL_TOKEN"`).
  Never print, log or record the value.
- Record the runner's approval mode. Outside auto mode, a non-interactive runner is refused every
  MCP call that needs approval, so a server that answered at the probe can refuse minutes later.

Every row you write is true at the moment of the probe and no later. Date the file so a later stage
reads it as a snapshot, not a guarantee.

### Always

| Tool | Probe | Blocks |
|---|---|---|
| Node + package manager | `node -v`, `npm -v` | everything |
| `NODE_ENV` | must not be `production` | dev dependencies install silently incomplete |
| Git + `gh` | `gh auth status`, note scopes | Stage 6 |
| Docker daemon | `docker info` | Stage 4 local database |
| Runner approval mode | interactive, auto, or non-interactive outside auto | every MCP write (WH-14) |
| Squad checks live | `test -f .squad/state/<build-name>.md > /dev/null` is **refused** with `[state-lint]` | every check in `.squad/checks/`; see *Prove the checks are live* |
| Git guard live | `git add -A --dry-run` is **refused** by the git guard | every commit (B3-15, B3-11) |
| Model table | see *Prove the model table reaches the stages* | every stage's model |

### Prove the checks are live

The squad checks and the git guard are Claude Code hooks, and a hook that is not running blocks
nothing while every stage believes it is protected (B3-7: a check nobody has seen refuse is not a
check). So the first two probes are commands each hook **must refuse**. A refusal is the pass:
do not record it as a block, log it or stop on it, even though the hook's message says to.

| Probe result | Status | What it means |
|---|---|---|
| Both refused | OK | The hooks run in this session, and inside subagents: you are one |
| Either ran (exit 0) | **BLOCKING** | The hook is not running here. Halt before Stage 1 |

Both probes do nothing when they run: the first only tests that the state file exists, with its
output thrown away, and `--dry-run` stages nothing. The first is refused because it names a live
state file and redirects (the state lint's Bash rule). The test that keeps it refused is in
`checks/test/hook.test.mjs`, so a change to the lint that lets it through fails CI.

When a probe ran, say which of the two causes fits in the BLOCKING line:

1. **A cloud thread in a Claude project.** These never run a repository's
   `.claude/settings.json` hooks and never load its `.claude/skills/` (Claude Code docs,
   *Claude projects*, "What threads pick up from your repositories", read 2026-11-25). The build
   must run in a local thread on Joel's machine, with Worktree on. Append this to `/ERRORS.md`: it
   is a fact about the environment, not this build.
2. **A session older than the stamp.** A local session started before `/squad init` registered the
   hooks has not loaded them. Restart the session and run Preflight again.

### Prove the model table reaches the stages

The state file's `models:` block names the model each role runs on, and the Orchestrator passes
that row when it fires a stage. Three probes, each observed, none of them a guess:

| Probe | OK when | Otherwise |
|---|---|---|
| Your own model, from your system prompt | It is in the family the `preflight` row names: a `haiku` row, a Claude Haiku model | **BLOCKING**: rows are not reaching the stages. Name the model you observed |
| The Orchestrator's model, as its brief to you gives it | It is the `orchestrator` row's alias, `fable` | **BLOCKING**: the one top tier is not on the top model. Joel switches the session with `/model fable` and Preflight runs again |
| `CLAUDE_CODE_SUBAGENT_MODEL_FORCE`, by name | Unset, or not `1` | **BLOCKING**: with `CLAUDE_CODE_SUBAGENT_MODEL` it forces one model on every stage and outranks every row (Claude Code docs, *Subagents*, read 2026-11-25) |

Write the alias and the full model ID you observed in the `Tier / version` cell, for example
`haiku → claude-haiku-5-5`, so the record says what each alias meant on the day. Never print an
environment variable's value beyond the model name.

### Per the stack this build will use

On a **greenfield** build the contract does not exist yet, so probe the default stack below.

**Brownfield:** the Surveyor ran before you. Probe the stack recorded in
`/builds/<build-name>/survey.md` §1 instead, and drop any row below the repo does not use. Probing
the default against a repo that deviates from it reports a clean bill of health for tools the build
will never touch.

| Tool | Probe | Blocks |
|---|---|---|
| Supabase MCP | `list_projects`, record **plan tier** | Stages 3–6 |
| Vercel | `vercel whoami` or `npx vercel@latest whoami`, `teams ls`; `VERCEL_TOKEN` set counts | Stage 6 |
| 21st.dev | `get_usage` for tier and remaining quota, **and** `API_KEY_21ST` set by name (TH-16) | Stage 2 Mode B |
| Figma | tools present? paid seat? | Stage 2 token extraction |
| `semgrep`, `gitleaks` | invocable by any route; if not, see *Acquiring an absent tool* | Stage 5 |
| Playwright | scaffolded per build, not global; browser build matches the pinned package (TH-19) | Stage 4 |

**Tier is not invocability** (TH-16). A tool can answer, on a paid tier, and still be unusable
here. Every row carries an **Invocable?** answer separate from its status and tier: can this
machine, now, do the thing the stage needs, by the route the stage will use?

**Playwright: compare versions, not presence** (TH-19). A pre-installed browser and a pinned
`@playwright/test` are two facts that drift apart on a clock. Read the Chromium revision the pinned
package expects from `playwright-core/browsers.json` and compare it with the revision directory
under the installed browser path (`/opt/pw-browsers` on Claude Code remote runners, as at
2026-08-24). A mismatch is DEGRADED for Stage 4, not OK. Where the environment forbids
`npx playwright install`, say so in the row; the fix is pinning the package to the installed
build, not installing a browser.

### Runtime credentials

Build tooling is half the probe. The application also needs secrets at runtime, and a missing one
breaks nothing until the first real request, which is after every gate has passed (TH-13).

List every secret the app will need at runtime:

- **Greenfield:** the default stack's (Supabase URL, publishable or anon key, service-role key,
  `VERCEL_TOKEN` for deploy), plus one per third-party service the intake names (payments, email,
  an LLM API, webhooks and their signing secrets).
- **Brownfield:** every variable in the host's `.env.example` and every environment read in the
  code the survey covers.

| Credential | Needed by | Obtainable here? | If not, what breaks |
|---|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | ledger writes, seed, sign-in | NO | every write path, and sign-in |

**Obtainable here?** takes one of three answers: `YES, set` (the variable is present by name);
`YES, via <tool> once <resource> exists` (a connected tool will return it when Stage 3 creates the
project); or `NO`. A `NO` is **BLOCKING** at this stage. A key someone means to add later is `NO`
until it is in the environment: the halt costs one question now instead of a failed Stage 6.

If the contract later names a runtime secret this table does not have, this section runs again
for that secret before Stage 3 starts.

### Acquiring an absent tool

Before you record any tool absent, try once to get it (WH-21):

1. The vendor's own release binary (one `curl` of the release asset).
2. The language's package route (`pipx`, `pip --user`, `npx`).

A package manager that cannot install is not decisive while the vendor binary has not been tried.
Skip any route the environment forbids, and record the rule as the reason.

Record the attempt in the row's Notes:

```
absent: install tried: <command> → succeeded | failed: <reason>
```

A tool recorded absent with no attempt line is an incomplete probe. The DEGRADED list carries only
what genuinely cannot be had.

---

## Recording plan tiers is not optional

A service's **plan** changes what later stages can do, and plan limits are invisible until they
bite. Build 1's Supabase free tier had no cloud branching, which invalidated QA's per-build
database-branch design after it was written.

For every service, record the tier and its operative limits, not just that the tool answered.

---

## Output

Write to `/builds/<build-name>/preflight.md`:

```
PREFLIGHT — <build-name>, <date>, approval mode: <mode>
BLOCKING: none | <list>
DEGRADED: none | <capability> | carried by: <stage> | substitute: <named> | not covered: <gap>

| Tool | Status | Invocable? | Tier / version | Notes |
|---|---|---|---|---|

| Credential | Needed by | Obtainable here? | If not, what breaks |
|---|---|---|---|
```

One DEGRADED line per capability lost.

Also append anything machine-specific and durable to `/ERRORS.md`: the shell that sets
`NODE_ENV=production`, the package manager that refuses third-party taps, the `npx` that resolves
the wrong binary, a pre-installed browser build that a pinned test package does not match. Those
are facts about this machine, not this build, and rediscovering them every time is pure waste.
With a browser mismatch, append the signal that identifies it at a glance: API tests passing
while every page test fails means the browser never launched.

---

## Halt rules

**Blocking:** a tool a stage cannot proceed without, or a runtime credential this environment
cannot supply. Halt and escalate before Stage 1.

**Degraded:** a capability is unavailable but a stated fallback exists. Do not halt. A DEGRADED
line names three things (TH-18), and a line missing any of them is incomplete:

1. **The stage that carries the loss**, and what it must say in its output, so a partial run never
   reads as a complete one.
2. **The named substitute.** The stage that inherits the loss does not invent one under time
   pressure.
3. **What the substitute does not cover.** Its blind spot is written down once, here, rather than
   reasoned out by whichever stage hits it.

```
DEGRADED: secret scanning (gitleaks) | carried by: 5a | substitute: semgrep p/secrets + literal
          greps over the tree | not covered: git history, a key committed then removed
```

Build 1's missing Figma MCP was degraded: carried by Stage 2, substitute sketch-derived tokens
marked `derived` rather than `extracted`, not covered: exact values from a design file.

If you cannot name a substitute, the capability is not degraded. It is blocking, or the stage that
needs it does not run, and you say which.

The distinction matters. Halting on everything trains the operator to wave preflight through.
