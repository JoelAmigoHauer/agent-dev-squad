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

**Stage 1 validation pass:** stack matches the decision tree, no deviation claimed, so there is
nothing for the substantive-reason check to reject. Passed first attempt, 0 of 2 redos used.

**Environment blockers — not escalations, but Stage 2 and 4 cannot start until cleared:**
```
21st.dev tier    Mode B requires a paid tier. Designer must confirm via get_usage.
Docker daemon    Not running. QA's local Supabase stack needs it.
gitleaks         Not installed. Security's second pass runs 2 of 3 scanners without it.
```

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
stage-1-architect:   done    (contract at /builds/invoice-chaser/contract.md)
stage-2-designer:    done    (mode B, 21st.dev components logged)
stage-3-engineer:    done
stage-4-qa:          loop 2/3 (2 failing tests, detail below)
stage-5-security:    done    (advisors clean)
stage-6-deploy:      pending
escalations:         none
```

Failing detail, when a loop is active, goes below the block:

```
QA loop 2/3 — failing:
  GAP 1  POST /api/invoices returns 500 on missing dueDate, contract says 400
         test: /builds/invoice-chaser/tests/api/invoices.spec.ts:44
         class: bug
  GAP 2  cross-org read not refused on GET /api/invoices
         test: /builds/invoice-chaser/tests/auth/tenancy.spec.ts:19
         class: bug
```
