# Pipeline state — template

**This file is the template, never a build's live state** (B3-13). At build start the Orchestrator
copies the block below to `/state/<app-name>.md` (on brownfield, `<change-name>`), and that file is
the build's state from then on. One build per state file: a second build gets its own file, never
a block in another's. client-portal's single state file absorbed two more builds, grew to 1,029
lines, and stopped being safe to edit.

The Orchestrator owns each build's state file. Every stage writes its status and output location
there on completion; the Orchestrator writes loop counters as each iteration starts.

Progress lives in the state file, never in the conversation. On a fresh session mid-run, read it
first and resume from the first stage not marked `done`. A state file that exists is a build in
progress.

When a build finishes, copy its block into `/builds/<app-name>/run-record.md` and delete
`/state/<app-name>.md`.

---

## Idle block — copy to `/state/<app-name>.md`

```
build:               none
mode:                —
started:             —
stage-0.25-surveyor: idle
stage-0.5-preflight: idle
stage-1-architect:   idle
stage-2-designer:    idle
stage-3-engineer:    idle
stage-4-qa:          idle
stage-5a-security:   idle
stage-6-deploy:      idle
stage-5b-security:   idle
stage-7-retro:       idle
standing:            none
escalations:         none
```

**The state file holds this block and nothing else.** Notes, validation results and loop detail go
to the append-only `/builds/<app-name>/log.md`, dated. Edit the state file by a unique anchor and
chain the commit to the edit, so a failed edit never ships a commit message.

**Amendment sets get their own lines**, one `pending` line per stage the set's `Routes to` table
names, added when the set is appended (B3-2):

```
amendment-set-2 (A14–A20):
  stage-2-designer:  pending
  stage-3-engineer:  pending
  stage-4-qa:        pending
```

**`standing:`** carries any learning a mid-build Stage 7 marked `BINDS THIS BUILD`, one line per
entry, naming the stages it binds, until the build closes (B3-4).

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
| `halted` | Cap hit, trigger fired, or the stage was killed by a container restart. Must carry a reason, e.g. `halted (container restart)` |
| `skipped` | Stage does not apply to this build's mode. Must carry the reason, e.g. `skipped (greenfield)` |

A `done` without an output path is not done.

---

## Caps

In `../CLAUDE.md`, which the Orchestrator always has loaded when it is writing a state file. One
copy, so the numbers cannot disagree with themselves.

---

## Worked example — `/state/invoice-chaser.md` mid-run

```
build: invoice-chaser
mode: greenfield
started: 2026-08-15T14:02
stage-0.25-surveyor: skipped (greenfield)
stage-0.5-preflight: done    (/builds/invoice-chaser/preflight.md — Figma degraded, Stage 2 carries it)
stage-1-architect:   done    (/builds/invoice-chaser/contract.md — class B, escalation no)
stage-2-designer:    done    (mode B, tokens derived, 21st.dev components logged)
stage-3-engineer:    done    (/builds/invoice-chaser/build-notes.md)
stage-4-qa:          loop 2/3 (2 failing tests, detail in log.md)
stage-5a-security:   done    (local test target, checks clean; advisors have no target until 5b)
stage-6-deploy:      pending
stage-5b-security:   pending
stage-7-retro:       pending
standing:            none
escalations:         none
```

Failing detail, when a loop is active, goes in `/builds/invoice-chaser/log.md`:

```
2026-08-15T15:12 AEST
QA loop 2/3 (cause: code) — failing:
  GAP 1  POST /api/invoices returns 500 on missing dueDate, contract says 400
         test: /builds/invoice-chaser/tests/api/invoices.spec.ts:44
         class: bug
  GAP 2  cross-org read not refused on GET /api/invoices
         test: /builds/invoice-chaser/tests/auth/tenancy.spec.ts:19
         class: bug
```
