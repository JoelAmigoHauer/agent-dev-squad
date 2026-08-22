# Pipeline state

Live state for the **current build only**. The Orchestrator owns this file. Every stage writes its
status and output location here on completion; the Orchestrator writes loop counters as each
iteration starts.

Progress lives here, never in the conversation. On a fresh session mid-run, read this file first
and resume from the first stage not marked `done`.

When a build finishes, copy this block into `/builds/<app-name>/` as the run record and reset the
file to the idle template below.

---

## Current

```
build:               none
started:             —
stage-0.5-preflight: idle
stage-1-architect:   idle
stage-2-designer:    idle
stage-3-engineer:    idle
stage-4-qa:          idle
stage-5a-security:   idle
stage-6-deploy:      idle
stage-5b-security:   idle
stage-7-retro:       idle
escalations:         none
```

Nothing below the block above until a build starts. Notes, validation results and loop detail are
added during a run and removed when it ends — a note left behind from the previous build reads as
current on the next one.

**Tooling blockers do not live here.** Preflight records them at Stage 0.5 in
`/builds/<app-name>/preflight.md`, as `BLOCKING` or `DEGRADED`, and durable machine facts go to
`/ERRORS.md`. Do not keep a second list in this file for them to disagree with.

---

## Status vocabulary

| Value | Meaning |
|---|---|
| `idle` | Not started, no build running |
| `pending` | Build running, this stage not reached |
| `running` | Currently executing |
| `loop n/N` | In a fix loop, iteration n of cap N |
| `done` | Complete. Must carry an output location in brackets |
| `halted` | Cap hit or trigger fired. Must carry a reason |

A `done` without an output path is not done.

---

## Caps

In `../CLAUDE.md`, which the Orchestrator always has loaded when it is writing this file. One copy,
so the numbers cannot disagree with themselves.

---

## Worked example — how a live run looks

```
build: invoice-chaser
started: 2026-08-15T14:02
stage-0.5-preflight: done    (/builds/invoice-chaser/preflight.md — Figma degraded, Stage 2 carries it)
stage-1-architect:   done    (/builds/invoice-chaser/contract.md — class B, escalation no)
stage-2-designer:    done    (mode B, tokens derived, 21st.dev components logged)
stage-3-engineer:    done    (/builds/invoice-chaser/build-notes.md)
stage-4-qa:          loop 2/3 (2 failing tests, detail below)
stage-5a-security:   done    (local checks clean — advisors are hosted-only, deferred to 5b)
stage-6-deploy:      pending
stage-5b-security:   pending
stage-7-retro:       pending
escalations:         none
```

Failing detail, when a loop is active, goes below the block:

```
QA loop 2/3 (cause: code) — failing:
  GAP 1  POST /api/invoices returns 500 on missing dueDate, contract says 400
         test: /builds/invoice-chaser/tests/api/invoices.spec.ts:44
         class: bug
  GAP 2  cross-org read not refused on GET /api/invoices
         test: /builds/invoice-chaser/tests/auth/tenancy.spec.ts:19
         class: bug
```
