# Survey — <build-name>

Written by: Surveyor, Stage 0.25. Brownfield builds only. Runs before Preflight.
Date: <YYYY-MM-DD>
Commit surveyed: <sha> — every later stage works from a branch off this commit.

This template is a scaffold, not the specification of what a survey must contain.
[../../agents/surveyor.md](../../agents/surveyor.md) is the binding copy — validate against it,
not against this file.

Everything below is what was **found**. The only interpretation is §10, and it is labelled a
draft.

---

## Result

```
SURVEY — <build-name>, <YYYY-MM-DD>, commit <sha>
MODE: brownfield
BUILDS: yes | no — <first error if no>
BINDINGS: <n> working, <n> read-verified, <n> wired-but-broken, <n> unwired
SCHEMA: captured from live catalogue | files only — <why>
GUARDRAIL DEBT: <n> items, all marked existing
HOST CONSTRAINTS: <n> folded in
INTENT DRAFT: ready for Joel
```

---

## 1. Stack as built

```
Frontend:                <name and version>
Hosting:                 
Database, auth, storage: 
UI components:           
Package manager:         
```

**Against the default stack:** matches | deviates — <what, and whether the deviation is reasoned
anywhere in the repo>

**Plan tiers detectable from config:** <service: tier, or "none detectable — Preflight probes">

**Hosted resources and their other writers:**

| Hosted resource | Used by this build for | Other writers | Their migrations or changes in this repo? |
|---|---|---|---|
| | | | yes / no |

---

## 2. Data model as it exists

Captured from the live catalogue first (columns, constraints, policies, functions, applied
migrations), read-only. Then the repo's migrations, per migration `applied | pending`, as the drift
comparison. Disagreements between capture, files and code are findings, not reconciliations.

```sql

```

---

## 3. API surface as built

| Route | Method | Request shape | Response shape | Source |
|---|---|---|---|---|
| | | `<typed>` or `untyped` | `<typed>` or `untyped` | `<file:line>` |

---

## 4. Screens as built

| Screen or shell | Path(s) | Empty state | Loading state | Error state | Screenshots |
|---|---|---|---|---|---|
| | | yes / no | yes / no | yes / no | `survey-screens/<name>-1440.png`, `-390.png` |

Shells are rows too (v0.3): the navigation, header, page frame and drawer, with the routes inside
each.

---

## 5. Flow bindings, extracted

| Flow | Screen | Reached from | Control | Calls | Post-condition | Status |
|---|---|---|---|---|---|---|
| | `/<path>` | | | | | `working` \| `read-verified` \| `wired-but-broken` \| `unwired` |

`working` needs runtime evidence. A wire that only reads as correct is `read-verified`.

---

## 6. Test state

```
Runner:           
Suite runs:       yes | no
Suite green:      yes | no — <n> failing
Flows covered:    <list from §5, or none>
```

| Shared dependency | Kind | Suites that use it |
|---|---|---|
| | | |

---

## 7. Build health

| Check | Command | Result | Detail |
|---|---|---|---|
| Type check | | pass / fail | <error count, first error> |
| Lint | | pass / fail | |
| Production build | | pass / fail | |

A failed production build is a `BLOCKING` finding for Stage 3, not a halt here.

---

## 8. Host conventions

Constraints pulled from the host `CLAUDE.md`, README, scripts, `.env.example` and CI. Each becomes
a contract clause.

| Constraint | Source | Binds which stage |
|---|---|---|
| | | |

Host tests that guard a structural rule are rows too, one per test, with the test's path as the
source.

---

## 9. Guardrail debt

Existing code against the Engineer's guardrails. All marked `existing` — recorded by Security and
QA, not blocking unless this build touches it.

| Item | Guardrail | Location | Status |
|---|---|---|---|
| | | `<file:line>` | `existing` |

---

## 10. Intent gap — draft intake

**A draft, for Joel to correct.** Built from TODOs, stubs, empty components, unwired controls and
the last twenty commit messages.

<two or three paragraphs: what this repository appears to have been in the middle of becoming>

**Joel's corrections:** <appended by the Orchestrator after Joel replies. Together with this file,
they are the Stage 0 intake>
