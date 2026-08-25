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
build:               thelma
started:             2026-08-24T13:57
stage-0.5-preflight: done    (/builds/thelma/preflight.md — 3 degraded, 0 blocking)
stage-1-architect:   done    (/builds/thelma/contract.md — class C, escalation resolved, A1–A3)
stage-2-designer:    done    (/builds/thelma/design.md — mode B, tokens derived, 12 from 21st.dev, 6 hand-built)
stage-3-engineer:    running
stage-4-qa:          pending
stage-5a-security:   pending
stage-6-deploy:      pending
stage-5b-security:   pending
stage-7-retro:       pending
escalations:         2026-08-24T14:20 stage-1-architect halt-trigger-1 — stack escalation fired,
                     triggers 4 (custodian APIs gated on firm credentials; order routing may need
                     static egress/mTLS that Vercel Pro lacks) and 5 (real-time streaming vs polled
                     snapshot market data). Contract complete and validated. Sent to Joel.
                     2026-08-24T14:35 stage-1-architect resolved — Joel answered: aggregator
                     (ByAllAccounts) for ingestion, polled snapshot prices, TypeScript agent graph.
                     Contract amended A1–A3. Stack unchanged. Stages 2 and 3 released.
```

Preflight degradations, and the stage each is charged to:

```
DEGRADED 1  Docker daemon absent — no local Supabase stack.
            carried by: stage-4-qa. Hosted Supabase branch instead of `supabase start`.
            stage-5a-security inherits the same loss for its pre-deploy checks.
DEGRADED 2  gitleaks unavailable — GitHub releases 403 via proxy, container route dead.
            carried by: stage-5a-security. Must state in security-review.md that it did not run.
DEGRADED 3  gh CLI absent.
            carried by: stage-6-deploy. GitHub MCP is the route. No capability lost.
DEGRADED 4  API_KEY_21ST not set — the 21st.dev `npx shadcn add` install route fails.
            FOUND AT STAGE 2, not at preflight. Tier probe passed; install path was never probed.
            carried by: stage-3-engineer. Components are retrieved via MCP get_component and
            vendored into components/ui/. Appended to /ERRORS.md. Stage 7 to fold into LEARNINGS.
```

Stage 1 validation pass: PASSED on first attempt, 0 of 2 redos used. Stack matches the decision
tree (default stack, no deviation proposed). Escalation reason is substantive — names the trigger
by number, quotes the spec text, names what the default stack concretely fails to do, and states
the proposal and its cost.

Flow-bindings reconciliation: run and repaired. Three routes in §3 were reached by no control
(`GET .../mandate`, `GET .../drift`, `GET /api/recommendations`); rows added. `GET /api/health` is
the one deliberate exception — a deploy probe, not a screen.

Intake variance: brief only. No sketch, no voice note, no Figma file. Stage 2 derives tokens
rather than extracting them, and says so in design.md.

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
escalations:         2026-08-24T14:20 stage-1-architect halt-trigger-1 — stack escalation fired,
                     triggers 4 (custodian APIs gated on firm credentials; order routing may need
                     static egress/mTLS that Vercel Pro lacks) and 5 (real-time streaming vs polled
                     snapshot market data). Contract complete and validated. Sent to Joel.
                     2026-08-24T14:35 stage-1-architect resolved — Joel answered: aggregator
                     (ByAllAccounts) for ingestion, polled snapshot prices, TypeScript agent graph.
                     Contract amended A1–A3. Stack unchanged. Stages 2 and 3 released.
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
