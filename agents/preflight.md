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

### Always
| Tool | Probe | Blocks |
|---|---|---|
| Node + package manager | `node -v`, `npm -v` | everything |
| `NODE_ENV` | must not be `production` | dev dependencies install silently incomplete |
| Git + `gh` | `gh auth status`, note scopes | Stage 6 |
| Docker daemon | `docker info` | Stage 4 local database |

### Per the contract's stack
| Tool | Probe | Blocks |
|---|---|---|
| Supabase MCP | `list_projects`, record **plan tier** | Stages 3–6 |
| Vercel | `vercel whoami`, `vercel teams ls` | Stage 6 |
| 21st.dev | `get_usage` — record tier and remaining quota | Stage 2 Mode B |
| Figma | tools present? paid seat? | Stage 2 token extraction |
| `semgrep`, `gitleaks` | binary resolves | Stage 5 |
| Playwright | scaffolded per build, not global | Stage 4 |

---

## Recording plan tiers is not optional

A service's **plan** changes what later stages can do, and plan limits are invisible until they
bite. Build 1's Supabase free tier had no cloud branching, which invalidated QA's per-build
database-branch design after it was written.

For every service, record the tier and its operative limits — not just that the tool answered.

---

## Output

Write to `/builds/<app-name>/preflight.md`:

```
PREFLIGHT — <app-name>, <date>
BLOCKING: none | <list>
DEGRADED: <capability lost, and which stage carries the loss>

| Tool | Status | Tier / version | Notes |
|---|---|---|---|
```

Also append anything machine-specific and durable to `/ERRORS.md` — the shell that sets
`NODE_ENV=production`, the package manager that refuses third-party taps, the `npx` that resolves
the wrong binary. Those are facts about this machine, not this build, and rediscovering them every
time is pure waste.

---

## Halt rules

**Blocking** — a tool a stage cannot proceed without. Halt and escalate before Stage 1.

**Degraded** — a capability is unavailable but a stated fallback exists. Do not halt. Record which
stage inherits the loss and what it must say in its output, so a partial run never reads as a
complete one. Build 1's missing Figma MCP was degraded: builds proceed sketch-derived, and the
Designer marks tokens `derived` rather than `extracted`.

The distinction matters. Halting on everything trains the operator to wave preflight through.
