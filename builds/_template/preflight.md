# Preflight — <app-name>

Written by: Preflight, Stage 0.5. Runs before the Architect writes a line.
Date: <YYYY-MM-DD>

This template is a scaffold, not the specification of what a preflight must check.
[../../agents/preflight.md](../../agents/preflight.md) is the binding copy — validate against it,
not against this file.

---

## Result

```
PREFLIGHT — <app-name>, <YYYY-MM-DD>
BLOCKING: none | <list>
DEGRADED: <capability lost, and which stage carries the loss>
```

**Blocking** is a tool a stage cannot proceed without — halt and escalate before Stage 1.
**Degraded** is a capability lost where a stated fallback exists — do not halt, but name the stage
that inherits the loss and what it must say in its output, so a partial run never reads as a
complete one.

Halting on everything trains the operator to wave preflight through. The distinction is the point.

---

## Probes

Record what you **found**, never what you expected. A tooling map records intent; this file records
reality. When a probe fails, the Notes cell names the stage that carries it.

### Always

| Tool | Status | Tier / version | Notes |
|---|---|---|---|
| Node + package manager |  |  |  |
| `NODE_ENV` |  | — | must not be `production` |
| Git + `gh` |  |  | record scopes |
| Docker daemon |  |  |  |

### Per the stack this build will use

Rows below are the default stack. Add, remove and rename to match the stack actually in play — and
if a service is not touched by this build, delete its row rather than marking it unknown.

| Tool | Status | Tier / version | Notes |
|---|---|---|---|
| Supabase |  |  | **plan tier is mandatory** |
| Vercel |  |  |  |
| 21st.dev |  |  | **plan tier is mandatory** — remaining quota |
| Figma |  |  | seat type, not just presence |
| `semgrep` |  |  |  |
| `gitleaks` |  |  |  |
| Playwright |  |  | scaffolded per build, not global |

---

## Plan tiers

**Not optional.** For every service above, record the tier and its operative limits — not just that
the tool answered. Plan limits change what later stages can do and are invisible until they bite.

These values are what the Architect copies into `contract.md` §4. A tier stated from memory, or
carried over from another build, is not a probe.

```
<service>:  <plan> — <operative limits: quotas, caps, what it cannot do>
```

---

## Durable machine facts

Anything machine-specific that will recur across builds — a shell exporting `NODE_ENV=production`,
a package manager refusing third-party taps, an `npx` resolving the wrong binary — is appended to
`/ERRORS.md` at the repo root, not left here.

`/ERRORS.md` is per-machine and cumulative; this file is per-build and a snapshot. Do not merge
them. If `/ERRORS.md` does not exist yet, create it.

```
APPENDED TO /ERRORS.md: none | <list>
```
