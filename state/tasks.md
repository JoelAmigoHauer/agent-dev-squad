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
stage-2-designer:    done    (/builds/thelma/design.md — mode B, tokens EXTRACTED, Figma JWOShrmCfUS7YVaGBArJHg)
stage-3-engineer:    done    (/builds/thelma/build-notes.md — 19 routes, 10 screens, build+start verified)
stage-4-qa:          done    (/builds/thelma/test-results.md — 113 passed, 3 skipped, 0 failing)
stage-5a-security:   done    (/builds/thelma/security-review.md — pass, 0 blocking, gitleaks NOT run)
stage-6-deploy:      halted  (/builds/thelma/deploy-record.md — SUPABASE_SERVICE_ROLE_KEY unobtainable; 0 of 2 attempts used)
stage-5b-security:   pending (blocked by stage-6)
stage-7-retro:       done    (8 learnings appended to /LEARNINGS.md — 1 critical, 3 high)
escalations:         2026-08-24T14:20 stage-1-architect halt-trigger-1 — stack escalation fired,
                     triggers 4 (custodian APIs gated on firm credentials; order routing may need
                     static egress/mTLS that Vercel Pro lacks) and 5 (real-time streaming vs polled
                     snapshot market data). Contract complete and validated. Sent to Joel.
                     2026-08-24T14:35 stage-1-architect resolved — Joel answered: aggregator
                     (ByAllAccounts) for ingestion, polled snapshot prices, TypeScript agent graph.
                     Contract amended A1–A3. Stack unchanged. Stages 2 and 3 released.
                     2026-08-25T01:30 stage-6-deploy halted — SUPABASE_SERVICE_ROLE_KEY cannot be
                     obtained in this session and the app cannot function without it (no ledger
                     writes, no monitoring cycle, no first user). No deploy attempted, so 0 of 2
                     attempts consumed. Sent to Joel.
```

RESUME POINT — this file is deliberately NOT reset. The build is paused, not finished, so the
idle template would erase where to pick it up. Resume at stage-6-deploy: set the environment
variables named in /builds/thelma/deploy-record.md (SUPABASE_SERVICE_ROLE_KEY is the blocker),
then Stage 6, then 5b. Stage 7 already ran, out of order, at Joel's direction (2026-08-25) so
the learnings were not lost to the halt. No run-record.md exists yet — that is written on
completion, and this build has not completed.

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

QA findings so far:
  GAP 1  cash reported as an unbanded band breach; rule 3 failed for any household holding cash
         test: /builds/thelma/tests/unit/guardrails.test.ts:149
         class: bug — FIXED, full suite re-run green, regression test pinned
  GAP 2  decision_ledger.firm_id is ON DELETE CASCADE but the append-only trigger blocks the
         cascade, so deleting a firm fails with a confusing trigger error instead of a clear
         constraint violation. contract §2 specifies both clauses; they contradict.
         class: spec-gap — no scope change, so no halt. Routed to the Architect as A5.

Stage 3 clarification: 1 raised, answered as contract amendment A4 (first-user mechanism is a
seed script, not a SQL migration — SQL cannot read process env). No schema or API change.

Environment blocker carried into stage 4: SUPABASE_SERVICE_ROLE_KEY is not obtainable in this
session (no MCP tool exposes it, which is correct). Ledger writes, the seed script and the agent
runtime's writes all need it. Unit tests are unaffected; full end-to-end flows are not runnable
here and QA must report that rather than claim a pass it did not obtain.

Intake variance: brief only. No sketch, no voice note, no Figma file at intake.

Stage 2 RE-DO, 2026-08-25, at Joel's request. designer.md permits the Designer to create a Figma
file where none exists; the first pass read the absence as settling the question instead. Created
`Thelma — Design System v1.0` (JWOShrmCfUS7YVaGBArJHg): 45 variables across Color (Light+Dark
modes), Spacing, Radius and Type; StatusPill/SeverityDot/DriftBar variant sets; S7 Recommendation
detail complete. Tokens pulled back via get_variable_defs and reconciled against globals.css —
21/21 exact, 0 mismatches. Tokens are now `extracted` and therefore BINDING on the Engineer.
Nine screens and eight components remain written-spec only; design.md §8 states which.

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
stage-6-deploy:      halted  (/builds/thelma/deploy-record.md — SUPABASE_SERVICE_ROLE_KEY unobtainable; 0 of 2 attempts used)
stage-5b-security:   pending (blocked by stage-6)
stage-7-retro:       done    (8 learnings appended to /LEARNINGS.md — 1 critical, 3 high)
escalations:         2026-08-24T14:20 stage-1-architect halt-trigger-1 — stack escalation fired,
                     triggers 4 (custodian APIs gated on firm credentials; order routing may need
                     static egress/mTLS that Vercel Pro lacks) and 5 (real-time streaming vs polled
                     snapshot market data). Contract complete and validated. Sent to Joel.
                     2026-08-24T14:35 stage-1-architect resolved — Joel answered: aggregator
                     (ByAllAccounts) for ingestion, polled snapshot prices, TypeScript agent graph.
                     Contract amended A1–A3. Stack unchanged. Stages 2 and 3 released.
                     2026-08-25T01:30 stage-6-deploy halted — SUPABASE_SERVICE_ROLE_KEY cannot be
                     obtained in this session and the app cannot function without it (no ledger
                     writes, no monitoring cycle, no first user). No deploy attempted, so 0 of 2
                     attempts consumed. Sent to Joel.
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
