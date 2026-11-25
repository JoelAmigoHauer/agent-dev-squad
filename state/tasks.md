# Pipeline state — template

**This file is the template, never a build's live state** (B3-13). At build start the Orchestrator
copies the block below to `/state/<build-name>.md`, one file per build. How the file is written,
resumed from and retired is *State protocol* in `../CLAUDE.md`, the binding copy. This file binds
the block's shape and the status vocabulary.

---

## Idle block — copy to `/state/<build-name>.md`

```
build:               none
mode:                —
format:              —
started:             —
stage-0.25-surveyor: idle
stage-0-intake:      idle
stage-0.5-preflight: idle
stage-1-architect:   idle
stage-1.5-copywriter: idle
stage-1.5-figure-check: idle
stage-2-designer:    idle
stage-3-engineer:    idle
stage-4-qa:          idle
stage-5a-security:   idle
stage-6-deploy:      idle
stage-5b-security:   idle
stage-7-retro:       idle
standing:            none
waived:              none
escalations:         none
```

**The state file holds this block and nothing else.** Notes go to `/builds/<build-name>/log.md`.

**Amendment sets get their own lines**, added as *State protocol* in `../CLAUDE.md` says. The shape:

```
amendment-set-2 (A14–A20):
  stage-1.5-copywriter: pending
  figure-check:      pending
  stage-2-designer:  pending
  stage-3-engineer:  pending
  stage-4-qa:        pending
```

**`stage-1.5-figure-check` is the Orchestrator's line, and only the Orchestrator writes it**
(WS-1). The Copywriter's own `done` never clears it. Every Copywriter pass sets it back to
`pending` (an amendment set's `figure-check` line, for that set), and no stage downstream of the
deck fires until it reads `done` again, with the `log.md` entry that records each figure.

**`stage-0-intake` is the Orchestrator's line too**: the kickoff interview runs in its own
context, by [../skills/kickoff-interview.md](../skills/kickoff-interview.md). It sits after the
Surveyor because on a brownfield build the survey is what the interview reads first. `intake-gate`
refuses it `done`, and refuses Preflight `running`, until `intake.md` answers every row.

**`format:`** is `—` until the interview's F9 settles it, then one of `web-app`, `saas`, `game`,
`iphone`, `integration` or `not-software`, and the same word as F9. `not-software` ends the build at
Stage 0: every later line is `skipped (format: not-software)`.

**`waived:`** is `none`, or one line per waiver: `<check> <reason>`. **Only Joel writes it**, on
github.com; the waiver guard refuses an agent that tries. A waiver lifts that check for this build.

**`standing:`** carries any learning a mid-build Stage 7 marked `BINDS THIS BUILD`, one line per
entry, naming the stages it binds, until the build closes (B3-4).

**Tooling blockers do not live here.** Preflight records them at Stage 0.5 in
`/builds/<build-name>/preflight.md`, as `BLOCKING` or `DEGRADED`, and durable machine facts go to
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
format: saas
started: 2026-08-15T14:02
stage-0.25-surveyor: skipped (greenfield)
stage-0-intake:      done    (/builds/invoice-chaser/intake.md, 13 asked, 15 read, 2 drafted)
stage-0.5-preflight: done    (/builds/invoice-chaser/preflight.md — Figma degraded, Stage 2 carries it)
stage-1-architect:   done    (/builds/invoice-chaser/contract/ — class B, escalation no)
stage-1.5-copywriter: done   (/builds/invoice-chaser/copy.md — 0 NEEDS SOURCE)
stage-1.5-figure-check: done (/builds/invoice-chaser/log.md — 4 verified, 0 corrected, 0 removed)
stage-2-designer:    done    (/builds/invoice-chaser/design.md — mode B, 21st.dev components logged)
stage-3-engineer:    done    (/builds/invoice-chaser/build-notes.md)
stage-4-qa:          loop 2/3 (2 failing tests, detail in log.md)
stage-5a-security:   done    (/builds/invoice-chaser/security-review.md — local test target, advisors wait for 5b)
stage-6-deploy:      pending
stage-5b-security:   pending
stage-7-retro:       pending
standing:            none
waived:              none
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
