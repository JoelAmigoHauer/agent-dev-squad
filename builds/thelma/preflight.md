# Preflight — thelma

Written by: Preflight, Stage 0.5. Runs before the Architect writes a line.
Date: 2026-08-24

Probed on this machine, this run. Every row records what was **found**, not what was expected.

---

## Result

```
PREFLIGHT — thelma, 2026-08-24
BLOCKING: none
DEGRADED: 1. Docker daemon absent — no local Supabase stack. Stage 4 carries it: QA runs against a
             hosted Supabase branch (confirmed available, billable at $0.01344/hr), not `supabase
             start`. Stage 5a inherits the same loss: its "local stack" checks run against a branch.
          2. `gitleaks` unavailable — GitHub releases 403 through the agent proxy and the
             `ghcr.io/gitleaks/gitleaks` container route is dead with Docker down. Stage 5a carries
             it: secret scanning falls back to semgrep secret rules + GitHub push protection, and
             5a must state in `security-review.md` that gitleaks did not run.
          3. `gh` CLI not installed. Stage 6 carries it: GitHub operations go through the GitHub
             MCP server, not the CLI. No capability lost, only a different route.
```

**Blocking** is a tool a stage cannot proceed without — halt and escalate before Stage 1.
**Degraded** is a capability lost where a stated fallback exists — do not halt, but name the stage
that inherits the loss and what it must say in its output.

Nothing found here blocks. All three losses have a stated fallback and a named stage carrying them.

---

## Probes

### Always

| Tool | Status | Tier / version | Notes |
|---|---|---|---|
| Node + package manager | OK | node v22.22.2, npm 10.9.7, pnpm 10.33.0 | npm registry reachable (`@playwright/test` resolves 1.62.1) |
| `NODE_ENV` | OK | unset (empty) | Not `production`. devDependencies will install. Build 1's silent-strip failure is not present here |
| Git + `gh` | DEGRADED | git 2.43.0; `gh` **not installed** | GitHub MCP server present and is the route for Stage 6. Repo scope: `joelamigohauer/agent-dev-squad` |
| Docker daemon | **DOWN** | no `/var/run/docker.sock` | Blocks local Supabase stack and any containerised tool. Stage 4 falls back to a hosted branch |

### Per the stack this build will use

Stack is not settled until Stage 1. Rows below cover the default stack; the Architect adds or
deletes rows if it departs from it.

| Tool | Status | Tier / version | Notes |
|---|---|---|---|
| Supabase (MCP) | OK | org `Joel's projects` — **branching available, billable** | 5 existing projects, all `INACTIVE`. No `thelma` project yet. Postgres 17 on recent projects |
| Vercel (MCP) | OK | team `Joel's projects` — **Pro** | Preview deploys available. Stage 6 unconstrained |
| 21st.dev (MCP) | OK | **paid** — no daily retrieval cap | `freeRetrievalsPerDay: null`. Build 1's 2-per-day cap is **not** present. Stage 2 Mode B unconstrained |
| Figma (MCP) | OK | Joel Hauer — **Full** seat, **pro** tier | Dev Mode MCP usable. See intake note below: no Thelma Figma file exists to pull from |
| `semgrep` | OK | 1.174.0 | Installed this run into `/opt/semgrep-venv`. Invoke as `/opt/semgrep-venv/bin/semgrep` — it is **not** on `PATH` |
| `gitleaks` | **UNAVAILABLE** | — | GitHub releases → 403 via proxy; container route dead (Docker down). Stage 5a carries it |
| Playwright | OK | `@playwright/test` 1.62.1; chromium-1194 pre-installed | Browsers at `/opt/pw-browsers`. **Never run `playwright install`** — `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` is set |

---

## Plan tiers

Probed this run. Not carried over from another build, not stated from memory. These are the values
the Architect copies into `contract.md` §4.

```
Supabase:  paid org (Vercel-managed integration org `vercel_icfg_cZt9Cmaa7nMoC30xaBd3fff0`)
           — branch creation returns a billable rate of $0.01344/hr, so cloud branching IS
             available. Build 1's free-tier "no branching" constraint does not apply.
           — all 5 existing projects sit `INACTIVE`; a new project must be created for this build.
           — operative limit to watch: branches bill hourly, so QA branches are torn down, not left.

Vercel:    Pro (team_TYU1N9pGXUueXJ9JuNumb1MJ)
           — preview deployments, per-branch envs and longer build ceilings all available.
           — no observed constraint on Stage 6.

21st.dev:  paid — unmetered
           — `freeRetrievalsPerDay: null`, `freeRetrievalsRemaining: null`. No daily cap.
           — search and metadata calls are free; only `get_component` was ever metered, and is not
             metered on this tier. Stage 2 may retrieve as many components as the design needs.

Figma:     pro tier, Full seat (`team::1459779202112412400`)
           — Dev Mode MCP extraction is permitted by seat.
           — NOT a tooling limit but a build fact: there is no Thelma Figma file. Stage 2 cannot
             extract tokens from a design that does not exist; it derives them. See intake note.
```

---

## Intake note — what actually landed

The pipeline's Stage 0 expects a sketch, an app name and a voice note. What landed for this build
is **a written product brief only**. No sketch, no voice note, no Figma file, no reference UI.

That is not a tooling failure and does not halt anything, but it changes what two stages can claim:

- **Stage 2 (Designer)** has no visual source. Figma tooling is present and licensed, but there is
  nothing to pull. Tokens are `derived`, never `extracted`, and `design.md` must say so.
- **Stage 1 (Architect)** is working from prose alone, so every screen and flow in the contract is
  inferred from the brief rather than read off a sketch. Flow bindings must be written from the
  brief's stated workflows, and anything the brief leaves open is an explicit assumption, not a
  quiet default.

---

## Durable machine facts

```
APPENDED TO /ERRORS.md: 5 facts — gh CLI absent, Docker daemon absent, pipx absent + PEP-668
                        collision, GitHub release downloads 403 via proxy, Playwright browsers
                        pre-installed.
```
