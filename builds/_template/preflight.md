# Preflight — <app-name>

Written by: Preflight, Stage 0.5. Runs before the Architect writes a line.
Date: <YYYY-MM-DD>

This template is a scaffold, not the specification of what a preflight must check.
[../../agents/preflight.md](../../agents/preflight.md) is the binding copy — validate against it,
not against this file.

---

## Result

```
PREFLIGHT — <app-name>, <YYYY-MM-DD>, approval mode: <mode>
BLOCKING: none | <list>
DEGRADED: none | <capability> | carried by: <stage> | substitute: <named> | not covered: <gap>
```

**Blocking** is a tool a stage cannot proceed without, or a runtime credential this environment
cannot supply. Halt and escalate before Stage 1.
**Degraded** is a capability lost where a stated fallback exists. Do not halt. One line per
capability, naming the stage that inherits the loss, the substitute, and what the substitute does
not cover, so a partial run never reads as a complete one.

Halting on everything trains the operator to wave preflight through. The distinction is the point.

---

## Probes

Record what you **found**, never what you expected. A tooling map records intent; this file records
reality. When a probe fails, the Notes cell names the stage that carries it. A tool recorded
absent carries its install attempt: `absent: install tried: <command> → succeeded | failed:
<reason>`. **Invocable?** is separate from status and tier: can this machine use it now, by the
route the stage will use?

### Always

| Tool | Status | Invocable? | Tier / version | Notes |
|---|---|---|---|---|
| Node + package manager |  |  |  |  |
| `NODE_ENV` |  |  | — | must not be `production` |
| Git + `gh` |  |  |  | record scopes |
| Docker daemon |  |  |  |  |
| Runner approval mode |  |  | — | interactive, auto, or non-interactive outside auto |

### Per the stack this build will use

Rows below are the default stack. Add, remove and rename to match the stack actually in play — and
if a service is not touched by this build, delete its row rather than marking it unknown.

| Tool | Status | Invocable? | Tier / version | Notes |
|---|---|---|---|---|
| Supabase |  |  |  | **plan tier is mandatory** |
| Vercel |  |  |  | `npx vercel@latest` with `VERCEL_TOKEN` set counts |
| 21st.dev |  |  |  | **plan tier is mandatory**, remaining quota, `API_KEY_21ST` set |
| Figma |  |  |  | seat type, not just presence |
| `semgrep` |  |  |  |  |
| `gitleaks` |  |  |  |  |
| Playwright |  |  |  | pinned package's expected browser build vs installed build |

### Runtime credentials

Every secret the app needs at runtime. **Obtainable here?** is `YES, set`, `YES, via <tool> once
<resource> exists`, or `NO`. A `NO` is blocking.

| Credential | Needed by | Obtainable here? | If not, what breaks |
|---|---|---|---|
|  |  |  |  |

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
