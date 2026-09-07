# Blueprint revisions — learnings, cumulative

Build 1 (`print-estimator`, greenfield, 2026-08-15) produced entries 1–12. Build 2 (`workshop-hub`
Phase 2, the first brownfield run through `/squad`, 2026-09-07) produced entries 13–19; its full
record is in that repository under `.squad/builds/workshop-hub/`. `BLUEPRINT.md` stays unedited as
the source record; this file is what the builds proved needs changing.

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

# Build 2 — workshop-hub, Phase 2 (2026-09-07), the first brownfield run

Derived from the run recorded in `builds/workshop-hub/`. Same test for inclusion as above: a stage
passed its own check and the product was still wrong, an environmental blocker, a contract field
invented mid-build, or a tool that could not run where its stage runs. Ordinary bugs the loop caught
are excluded — the Engineer's own smoke test catching the handler's clock-skew defect before QA ran is
the system working, not a lesson.

---

## 13. workshop-hub — a binding marked `working` was refused by the database — HIGH

**What happened.** The Surveyor marked "Advance stage" `working` after reading the page (posts the
stage key) and the handler (validates it with the rulebook, inserts it). Only the schema capture at
Preflight showed that `workshop_state.phase` was check-constrained to three *other* values, so every
press of that button since 6 August had been refused with a 400 that the handler reported as 502.
Code and database each held a copy of the phase list and had diverged a month earlier.

**Why it is systemic.** `working` conflated *read-verified* (both ends of the wire agree) with
*runtime-verified* (the write actually lands). On a brownfield build the third end — the database —
is not in the repository at all unless migrations are, and this repo had none. Any brownfield build
whose schema lives only on the hosted project will pass a code-reading survey while the data layer
disagrees.

**The change.** `agents/surveyor.md` §5: the status vocabulary gains the distinction — `working`
requires a runtime probe or a capture that includes the data layer; a code-only reading is
`read-verified` and the Architect treats it as `changing` until proven. §2: on brownfield the schema
is **captured from the live catalogue** (columns, constraints, policies, functions, migration list)
as a precondition, never reconstructed from handler code; the reconstruction stays only as the drift
comparison. `agents/architect.md` and `agents/security.md`: the rule this build recorded as ADR 0005
— *the database constrains shape, the rulebook constrains values* — as the default for any value list
the code already owns.

---

## 14. workshop-hub — tool availability changed three times during one run — HIGH

**What happened.** Preflight probed the Supabase and Vercel MCP servers at 10:52Z and they answered.
At 11:00Z, when the session left auto mode, every MCP call returned "requires approval", which a
non-interactive runner cannot grant; Stages 3–5a ran with the migration written but unapplied and
the advisors unrun. At 21:30Z the MCP servers reconnected under new names and answered again; the
migration was applied and 5b ran. Separately, Preflight recorded `vercel` CLI as *absent* because
`command -v vercel` failed, yet `npx vercel@latest` with the `VERCEL_TOKEN` already in the
environment deployed first time.

**Why it is systemic.** Preflight tests **binaries at one moment**. On a remote runner a capability
is a function of the binary, the credential in the environment, the package fetcher, and the
approval mode — and the last of those changes without notice. A stage that assumes Preflight's answer
still holds will halt on a capability that is present, or plan around one that has gone.

**The change.** `agents/preflight.md`: probe **capabilities, not binaries** — `npx <tool> --version`
and the presence of the credential by name (`VERCEL_TOKEN`, never its value) count as present; record
the runner's approval mode as a row. `CLAUDE.md` context-loading/stage rules: any stage that depends
on an MCP write re-probes immediately before relying on it and records `cause: environment` on a
refusal rather than halting. `ERRORS.md` template gains the fact: MCP calls succeed in auto mode and
are denied outside it in a non-interactive session.

---

## 15. workshop-hub — the contract asserted a host-shell mechanic the host's own test forbids — MEDIUM

**What happened.** The Architect wrote `sections: ['choose']` for three new stages. The host shell's
`roomRender` toggles every stage's sections in order, so a section claimed by three stages ends up
hidden whenever the visible stage is not the last claimant — and the host already had a test, "no two
stages claim the same section", that encodes exactly that. It failed on the Engineer's first run and
became the run's one contract amendment.

**Why it is systemic.** In brownfield mode the contract makes structural claims about code the
Architect has read but not executed. The cheapest validator of those claims already exists: the
host's own test suite. The survey's §8 listed conventions from `CLAUDE.md` and ADRs but not the
invariants the host's tests enforce, so the Architect never saw this one.

**The change.** `agents/surveyor.md` §8: list the invariants the host's tests encode, one row per
test that guards a structural rule (not per assertion), as host constraints. `agents/architect.md`
brownfield mode: before validation, run the host's existing test suite against any rulebook or
config change the contract prescribes — a red host test is a contract defect, not an Engineer task.

---

## 16. workshop-hub — QA's harness section assumes a stack the contract may not have — MEDIUM

**What happened.** `agents/qa.md` mandates a local Supabase stack (`supabase start`, `db reset`) and a
Playwright `webServer` of `npm run build && npm start`. This build had no Docker daemon, no CLI, a
free tier with no branching, and a host constraint forbidding a build step. The Architect had to
design the test harness in the contract: a zero-dependency dev server with an in-memory PostgREST
double that enforces the migration's checks and RLS, plus one-shot live SQL assertions after the
migration. It worked — 40/40 through the UI — but it was invented mid-build.

**Why it is systemic.** The harness prescription is greenfield-and-Next.js-specific. Every brownfield
build, and any greenfield build whose plan tier or runner lacks Docker, hits the same gap at Stage 4,
after the contract is written.

**The change.** `agents/qa.md`: the `webServer` command is **whatever the contract names** as the
build-and-serve equivalent (§4 gains that field); the local-stack section becomes one of three
sanctioned strategies — local stack, in-memory double with post-migration live assertions, or cloud
branch — chosen in the contract with the reason. `agents/architect.md` §4 gains "Test strategy" as a
mandatory subsection whenever Preflight reports the local stack degraded.

---

## 17. workshop-hub — deploy verification writes production data and nothing says who deletes it — LOW

**What happened.** The deploy sequence requires "one write path verified in the database" on preview
and on production. Doing it created three sessions, nine candidates, ten votes and twenty-four
choose rows in the only database the app has. Deleting them needed a service-role SQL statement
across seven tables that no brief mentions.

**Why it is systemic.** Every verified deploy creates test data in production by definition; the
sequence names the write but not its removal, so it accumulates or gets removed ad hoc.

**The change.** `skills/deploy-sequence.md` §5 and §7: smoke sessions carry a fixed prefix
(`squad-smoke-`), and the sequence ends with a recorded delete of every row keyed to them, listed in
the deploy record. `agents/devops.md` deploy record gains `SMOKE DATA REMOVED: <counts>`.

---

## 18. workshop-hub — the rollback target can be a month old — LOW

**What happened.** Production had been pointing at a deployment from 6 August while nine later
commits existed only as un-promoted previews. Promoting this build made the rollback target a build
that predates the stage machine, the shared rulebook and the ADRs — a rollback would restore a month-
old app, not yesterday's.

**Why it is systemic.** Brownfield repos deployed by hand accumulate previews nobody promotes. The
survey records the gap (§7 did), but the deploy sequence assumes the previous production deployment
is a safe near-past.

**The change.** `skills/deploy-sequence.md` §6: record the rollback target's **commit and age**, and
when it is behind the base branch by more than the build's own commits, say so in the deploy record
as a caveat — the rollback is a regression, not a recovery, and Joel decides in advance whether that
is acceptable.

---

## 19. workshop-hub — the Retro's own file lives in two places — LOW

**What happened.** On a `/squad` run the pipeline is stamped into the host repo's `.squad/`, so this
file is a copy pinned to one template commit. Stage 7 appends here; the template repository, which
the next `/squad` run will stamp from, does not see it unless someone ports it.

**Why it is systemic.** Every brownfield run produces learnings into a copy. Without a return path the
template stops learning exactly when it is used most.

**The change.** `.claude/skills/squad/SKILL.md`: the run ends with a "port learnings" step — the
Retro's new entries are added to the template repository's `LEARNINGS.md` and listed under its
`CLAUDE.md` *Known gaps* until the stage files absorb them. Done by hand for this run.

---

## What worked in build 2 and should not be changed

- **Capturing the live schema before the Architect ran** found the month-old stage-machine failure
  that no amount of code reading had. Intake item 3 was Joel's call; it should be the default.
- **The contract's verbatim-copy clause (C13)** kept every deck string identical across rulebook, page,
  handler and tests. Nothing was paraphrased and nothing had to be reconciled.
- **The in-memory PostgREST double** enforced the migration's checks and RLS locally, so the test
  that proves an attendee cannot write a choose row ran forty times before the live one ran once.
- **The Engineer's own smoke run** caught the clock-skew defect in the handler's optimistic
  re-derivation before QA saw it, and the fix (the database returns its own `created_at`) is now the
  pattern for any append-only log the client re-derives.
- **PIN authority inside the database** (`choose_record` as SECURITY DEFINER with no anon INSERT
  policy) was cheaper than the handler-only gating it replaced and gave the advisors exactly one
  class of warning to accept. The eight existing tables still carry the older pattern.
- **Preview first, promote the tested deployment, verify production with one real write path**
  worked exactly as written, first attempt, including the migration-before-preview ordering.

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
