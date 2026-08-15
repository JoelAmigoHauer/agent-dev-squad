# Blueprint revisions — learnings from build 1

Derived from `print-estimator`, the first end-to-end run of the pipeline (2026-08-15).
`BLUEPRINT.md` stays unedited as the source record; this file is what build 1 proved needs changing.

Ranked by cost of leaving it alone. Each entry states what actually happened, why it is systemic
rather than a one-off, and the specific change.

---

## 1. The contract specifies surfaces, never connections — CRITICAL

**What happened.** Contract §1 listed the user flow "Staff signs in → Quotes list → New quote".
Contract §3 listed `POST /api/quotes`. The Designer drew the button. The Engineer built the route
and the screen. QA generated tests from the contract and all 31 passed. The deployed application
could not create a quote, because nothing wired the button to the route — and nothing in the
contract said it had to.

**Why it is systemic.** Every stage verified its own half. The contract describes *nouns* (screens,
routes) and describes flows only as prose. Prose is not testable, so QA tested the nouns. This will
recur on every build where a flow crosses the UI/API boundary, which is every build.

**The change.** `agents/architect.md` §3 gains a mandatory **flow binding table**: each user flow
names the screen, the control, the route it calls, and the post-condition. `agents/qa.md` changes
"core user flows, end to end" to explicitly mean *driving the interface* — a flow test that calls
an API directly does not count as covering that flow.

```
| Flow | Screen | Control | Calls | Post-condition |
|---|---|---|---|---|
| Create quote | Quotes list | "New quote" | POST /api/quotes | lands on /quotes/:id |
```

---

## 2. Nothing validates the toolchain before the build starts — HIGH

**What happened.** Discovered mid-build, in this order: no Figma MCP connected at all; 21st.dev on
a free tier capped at 2 component retrievals per day; `gitleaks` not installed and Homebrew unable
to install anything; Docker daemon down; `NODE_ENV=production` set in the shell, silently stripping
every devDependency from `npm install`; `npx tsc` resolving to the wrong package. Each was found at
the moment it blocked something, which is the most expensive moment.

**Why it is systemic.** Section 13's tooling map records *intent*. Nothing checks reality. Every
future build starts by rediscovering the same machine facts.

**The change.** Add **Stage 0.5 — Preflight**, before Stage 1, owned by the Orchestrator. It probes
every tool the contract's stack will need, writes results to the build folder, and halts cheaply if
a stage's tooling is absent. Cost: seconds. It also writes an `ERRORS.md`-style environment record
so machine facts are learned once, not per build.

---

## 3. Security's first-pass tool cannot run where Security runs — HIGH

**What happened.** Supabase advisors are a hosted-project feature. Stage 5 runs against the local
stack, so advisors could not run at all. I substituted hand-written SQL checks. When advisors
finally ran at Stage 6 against the deployed project they found **7 issues**, four of them real and
two caused by a `grant execute … to anon` I had written myself.

**Why it is systemic.** The blueprint places advisors in Stage 5 and Stage 5 before deploy. Those
two facts are incompatible for any hosted-only tool.

**The change.** Security runs **twice**: `5a` pre-deploy against local (substitute checks), and
`5b` post-deploy against the real project, before the deploy is considered complete. Stage 6 does
not finish until 5b is clean or its findings are explicitly accepted in writing. `agents/devops.md`
gains advisors as a post-promote gate.

---

## 4. Loop caps count iterations, not causes — HIGH

**What happened.** Two QA "failures" during the fix loop were not code defects. A type error meant
the build never ran, so Playwright reused the previous binary. Then a stale `next start` held port
3000 and a probe hit the old server. Both looked exactly like the fix having failed.

**Why it is systemic.** The caps exist to stop agents re-fixing the same function forever. But a
cap that counts environmental re-runs punishes the wrong thing — under a strict reading, two of
three QA iterations were spent on non-defects, and the third failure would have escalated a build
that was actually fine.

**The change.** Caps count only iterations where **the diagnosis was a code defect**. An iteration
whose root cause was environmental is logged but does not consume the cap. `agents/qa.md` and
`agents/security.md` gain a required diagnosis line per iteration: `cause: code | environment`.
`agents/engineer.md` gains: before diagnosing a post-fix failure, confirm the binary under test
contains the fix.

---

## 5. The contract had no fidelity field, and no production-bootstrap field — HIGH

**What happened.** Two clarifications went back to the Architect mid-build for things the contract
should have carried from the start. The Designer had to choose Mode A or B with no information —
only the Architect saw the intake. And "users are seeded" described local development only, leaving
no way for a first user to exist in production; discovered at Stage 3, would have blocked Stage 6.

**Why it is systemic.** Both are questions every build asks. Neither is in the blueprint's mandatory
output list.

**The change.** `agents/architect.md` output contract gains two mandatory fields:
`FIDELITY: prototype | production` and `FIRST USER: how the first account exists in a deployed
database`. Both already added to the template; the blueprint's §2 list needs them too.

---

## 6. Runtime plan limits are a Stage 1 input, discovered at Stage 6 — MEDIUM

**What happened.** The Supabase free plan sleeps after roughly a week idle, allows two active
projects, and has no cloud branching — which invalidated QA's original per-build database branch
design. The Vercel commercial-use question surfaced at deploy. All three are properties of the
stack the Architect chose.

**Why it is systemic.** The stack decision tree picks *products* and says nothing about *plans*, but
plan limits change what later stages can do.

**The change.** `skills/stack-decision.md` gains a fourth output: the plan tier for each service and
its operative limits. A stack whose plan cannot support the contract's requirements is an
escalation trigger in its own right.

---

## 7. An absent tool and a clean tool look identical — MEDIUM

**What happened.** `semgrep --quiet` on a clean run prints nothing. So does a semgrep that never
ran. I only caught it by re-running without `--quiet` to see `Ran 110 rules on 29 files`.

**Why it is systemic.** Every automated gate has this failure mode, and it fails *toward* a false
pass — the worst direction.

**The change.** QA's "silent patching is banned" gains a counterpart in both briefs: **silent
passing is banned**. Every automated check reports what it *ran* — rule counts, file counts, tool
versions — not only what it found. A report without evidence of execution is not a pass.

---

## 8. The deploy sequence assumes a project that already exists — MEDIUM

**What happened.** `skills/deploy-sequence.md` mandates preview → verify → promote. Vercel assigns
a project's **first** deployment to production regardless of flags. Preview-first was not skipped,
it was impossible. That deployment also had no rollback target, because there was no previous
deployment.

**Why it is systemic.** Every new build hits its first deploy exactly once, and that is the deploy
with the least safety.

**The change.** `skills/deploy-sequence.md` gains a first-deployment branch: acknowledge no
rollback target exists, require the production smoke test to pass before the URL is shared, and
require preview environment variables to be set before deployment 2.

---

## 9. The 30-minute goal state is unqualified — MEDIUM

**What happened.** `print-estimator` is a rate-card configurator with a pricing engine, multi-tenant
RLS and a snapshot rule. It was never a 30-minute build, and the contract had to say so explicitly
to stop the miss reading as a pipeline failure.

**Why it is systemic.** Section 12 states one target for "simple single-purpose app" and nothing for
anything else, so every non-trivial build looks like an underperformance.

**The change.** The Architect classifies each build against the goal-state table in the contract,
and the class sets the expectation. Add at least one class above "CRUD plus auth" — domain logic
with derived values — with its own realistic target.

---

## 10. Nothing writes learnings back — MEDIUM

**What happened.** This document exists because I kept notes by hand across the run. Nothing in the
pipeline required it, and nothing would have produced it on the next build.

**Why it is systemic.** A pipeline that cannot improve itself will repeat every defect above.

**The change.** Add **Stage 7 — Retro**, a short mechanical pass after deploy: every gap, false
failure, environmental blocker and accepted risk from the build's own records, appended to this
file. Cheap, because the records already exist — `test-results.md`, `security-review.md`,
`deploy-record.md` and the contract amendments already contain all of it.

---

## 11. Design tokens need an extraction contract — LOW

**What happened.** `design.md` marked tokens `derived` until Figma existed, then `extracted`. That
distinction turned out to be load-bearing — the Engineer treats derived values as adjustable and
extracted values as binding — but it was invented mid-build.

**The change.** Formalise `derived | extracted` in `agents/designer.md` as a required per-token
status, and state the Engineer's obligation for each. Also record that Figma variables must carry
**WEB code syntax**: because they did, `get_variable_defs` returned values already keyed by CSS
custom property and the handoff was a copy rather than a translation.

---

## 12. Cloned UI is not shared UI — LOW

**What happened.** The Figma nav rail was cloned across four screens rather than made a component.
Editing it means editing it four times.

**The change.** `agents/designer.md`: any element appearing on more than one screen is a component,
not a clone. Applies to Figma and to code.

---

# What worked and should not be changed

Recorded because the temptation after a defect list is to change everything.

- **Contract-first was vindicated repeatedly.** The pricing formula was specified to the cent
  including rounding, and the Engineer, the Figma mock and the live API all produced `$391.18`
  independently. Nothing was negotiated at implementation time.
- **Generated types caught a real bug** the moment a loose `Record<string, unknown>` was introduced.
  Guardrail 4 earns its place.
- **The Designer→Architect clarification loop worked exactly as designed**, twice, and the second
  one exposed a genuine race condition in the obvious `max(quote_number)` implementation before any
  code existed.
- **Database-level invariants beat application-level ones.** The totals trigger and the tier-overlap
  exclusion constraint hold regardless of which code path writes, and both were verified live.
- **404-over-403 for cross-tenant access** was specified in the contract and tested in both
  directions. Worth keeping as a default in every contract.
- **The tier check that stopped Stage 2** — Designer refusing to start Mode B until `get_usage`
  confirmed a paid tier — is the cheapest halt in the whole run. More gates should look like it.
