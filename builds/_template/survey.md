# Survey — <change-name>

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
SURVEY — <change-name>, <YYYY-MM-DD>, commit <sha>
MODE: brownfield
BUILDS: yes | no — <first error if no>
BINDINGS: <n> working, <n> wired-but-broken, <n> unwired
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

---

## 2. Data model as it exists

Per migration, `applied | pending`. Disagreements between code and schema are findings, not
reconciliations.

```sql

```

---

## 3. API surface as built

| Route | Method | Request shape | Response shape | Source |
|---|---|---|---|---|
| | | `<typed>` or `untyped` | `<typed>` or `untyped` | `<file:line>` |

---

## 4. Screens as built

| Screen | Path | Empty state | Loading state | Error state |
|---|---|---|---|---|
| | | yes / no | yes / no | yes / no |

---

## 5. Flow bindings, extracted

| Flow | Screen | Control | Calls | Post-condition | Status |
|---|---|---|---|---|---|
| | | | | | `working` \| `wired-but-broken` \| `unwired` |

---

## 6. Test state

```
Runner:           
Suite runs:       yes | no
Suite green:      yes | no — <n> failing
Flows covered:    <list from §5, or none>
```

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
