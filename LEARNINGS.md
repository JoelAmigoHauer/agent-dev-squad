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

## 20. workshop-hub-end — the deploy CLI invents a project when the link is missing — HIGH
WHAT HAPPENED: The first `npx vercel --yes` from `app/` did not deploy to `methodworks-workshop-hub`.
  It created a **new Vercel project called `app`**, named after the directory, linked it to the
  GitHub repo, and deployed there. The command reported success. Nothing in the deploy sequence
  checks which project it is about to deploy to, so the step passed its own check and the outcome
  was wrong — the exact failure class this file exists for.
WHY IT IS SYSTEMIC: `.vercel/` is git-ignored (correctly — it holds an OIDC token), so the project
  link never survives into a fresh container. Every run in a new container starts unlinked, and
  `--yes`, which the pipeline needs for non-interactive use, converts "which project?" from a prompt
  into a silent creation. Build 2 missed it only because its container happened to still hold a link
  from an earlier interactive run. Left alone this recurs on every first deploy of every session.
  **And the artefact it leaves does not stay still:** the CLI links the new project to the GitHub
  repository, so the stray project auto-deployed on every subsequent push to the branch — three more
  builds before anyone looked at it, silently shadowing the real project. A mistake that keeps
  building itself is worth catching at the first command rather than the fourth.
THE CHANGE: `skills/deploy-sequence.md` §3 gains a mandatory first step before any deploy —
  `npx vercel link --yes --project <name> --scope <team>` — and a verification line: read back
  `.vercel/project.json` and confirm `projectName` matches the contract's C14 project before
  deploying. `agents/devops.md` platform notes carry the same rule.
SEVERITY: high

## 21. workshop-hub-end — Preflight records a tool as absent and nobody ever tries to get it — HIGH
WHAT HAPPENED: Preflight recorded `semgrep` absent on this runner, for the second build running, and
  Security inherited "1 of 3 scanners" as a degraded capability. At Stage 5a, installing it took
  under five minutes (`python3 -m pip install --ignore-installed PyJWT semgrep`), and it then scanned
  29 files and produced a real result. Two builds had accepted a permanent-looking gap that was five
  minutes of work.
WHY IT IS SYSTEMIC: `agents/preflight.md` asks "does the binary resolve?" and the answer feeds a
  Degraded table. There is no step that asks whether an absent tool is *cheaply obtainable*, and the
  word "degraded" reads as a settled fact rather than an open question. A stage that inherits a
  degradation has every incentive to accept it, because accepting is one line and fixing is unbudgeted
  work. The same logic had kept `gitleaks` unrun for three builds, each recording it as
  unavoidable because Homebrew and the Docker image were both out of reach. **Asked for it directly,
  it took one `curl` of the vendor's release binary** — the same lesson, twice in one day, on two
  different tools. Neither gap was ever real; both were merely unexamined.
THE CHANGE: `agents/preflight.md`, *What you check* — every absent tool gets a one-line acquisition
  attempt and its result recorded next to it: `absent — install tried: <command> → succeeded |
  failed: <reason>`. A tool recorded absent with no attempt line is an incomplete probe, and the
  probe must try the vendor's own release binary before treating a package manager's absence as
  decisive. The Degraded table then carries only what genuinely cannot be had.
SEVERITY: high

## 22. workshop-hub-end — time-derived state cannot be tested by rewinding one record — MEDIUM
WHAT HAPPENED: The lock is derived from a close timestamp plus twenty minutes. Testing the locked
  state means stamping a close time in the past. Three separate attempts failed the same way — twice
  against the dev server, once against the live project — because the "current" state is the newest
  row **by `created_at`**, so a row stamped 21 minutes ago and inserted after a row stamped a moment
  ago simply loses. Each failure looked like a broken lock and was actually correct behaviour.
WHY IT IS SYSTEMIC: this pipeline now recommends append-only logs as a default (ADR 0005 in build 2,
  ADR 0006 here), and "current = newest by timestamp" is intrinsic to that pattern. Any build that
  derives state from elapsed time inherits the property, and `agents/qa.md` says nothing about how to
  drive a clock. Three repetitions inside one build, by an agent that had already diagnosed it once,
  is the signature of a missing written rule rather than carelessness.
THE CHANGE: `agents/qa.md`, *Test data*, gains a paragraph: when state is derived from elapsed time,
  test it by controlling the stored timestamp, never by waiting, and **use a fresh fixture for each
  position in the window** — a single record cannot be walked backwards through it. Note that the
  arithmetic itself belongs in a pure unit test, where the clock is an argument.
SEVERITY: medium

## 23. workshop-hub-end — `vercel promote` cannot promote a preview built with preview variables — MEDIUM
WHAT HAPPENED: `skills/deploy-sequence.md` §6 says to capture the rollback target and then promote
  the tested preview. `vercel promote <preview-id>` refused: a preview built with preview environment
  variables cannot be promoted directly, and the CLI offers to rebuild with production variables
  instead. The sequence had no branch for that, so the step had to be improvised mid-deploy.
WHY IT IS SYSTEMIC: the two environments have different variables in every project that has any
  secrets at all, which is every project this pipeline will deploy. Build 2's promote succeeded only
  because its preview had been produced in a way that made the artifacts interchangeable. The written
  step is therefore wrong more often than it is right.
THE CHANGE: `skills/deploy-sequence.md` §6 states both paths: promote when the preview and production
  environments match, and otherwise deploy `--prod` from the identical tree and **prove equivalence**
  — for a repo with no build step, by diffing the served page against the tested preview and
  accounting for every difference (Vercel injects a preview feedback script). Record which path was
  taken in the deploy record.
SEVERITY: medium

## 24. workshop-hub-end — the loop-cause vocabulary has no word for a defective test — LOW
WHAT HAPPENED: QA's first suite run had two failures, both in the tests rather than the build: one
  expected a phase value to be refused that the handler has always lower-cased, and one hit the
  ordering trap in entry 22. Neither was a gap against the contract and neither should consume a
  fix-loop iteration, but `cause: code | environment` has no third value, so the honest label had to
  be invented in the record (`cause: test-authoring`).
WHY IT IS SYSTEMIC: tests are written from the contract before or alongside the build, so a test
  defect found before the suite is ever green is a normal event, not an exception. With only two
  labels available the pressure is to record it as `code` (which wrongly consumes a cap and implicates
  the Engineer) or to say nothing (which makes a suite that went green on its second run look like it
  went green on its first).
THE CHANGE: `agents/qa.md` and `agents/security.md` extend the diagnosis line to
  `cause: code | environment | test-defect`, with `test-defect` explicitly not consuming the cap and
  required to be recorded rather than silently fixed. `CLAUDE.md`'s *Loop caps* section carries the
  same three values.
SEVERITY: low

**Still open from build 2, second consecutive manual port.** Entry 19 (learnings from `/squad` runs
have no return path) is unchanged: this build's entries were again carried to the template by hand.
Two builds is enough evidence that the port step will not happen by itself.

## 25. workshop-hub-room-runner — "additive migration" was read as "order does not matter" — HIGH

**What broke.** Build 4 took production down by applying a migration that removed a policy its
still-deployed handler depended on. The lesson taken from that was *make migrations additive*, and
this build's contract, build notes and commit message all said so. They then went further and said
the migration and the deploy could therefore land **in either order**. That was wrong, and it was
caught at Stage 6 by reading the handler rather than by any test.

`create` writes `expected_headcount` into `workshop_sessions`. Against a database without that
column PostgREST answers `PGRST204` and the insert fails, so a deploy landing before its migration
would not have degraded the head count — it would have made it impossible to create a session at
all. Build 4's incident, in mirror image, from a rule written to prevent build 4's incident.

**Why it is systemic.** "Additive" describes the *migration's* effect on running code: nothing is
taken away, so the old deployment keeps working. It says nothing about the *new* code's dependence
on the new schema, which is the other direction entirely. Every build that adds a column a write
path populates has this property, and the vocabulary the squad inherited has one word covering two
independent questions.

**The fix.** `agents/architect.md` §2 needs both questions asked and answered separately in the
contract, and `agents/devops.md`'s record needs the answer carried:

| Question | Answer decides |
|---|---|
| Does the migration break the **currently deployed** code? | whether it may be applied early |
| Does the **new** code fail against the **old** schema? | whether it *must* be applied early |

Two "no"s mean either order. This build was no / yes: safe to apply early, and required to.
Build 4 was yes / yes, which is the only genuinely dangerous combination and needs one window.

---

## 26. workshop-hub-room-runner — the `[hidden]` guard is a hand-maintained list, so it stops guarding — HIGH

**What broke.** Host constraint C2 — any class with a `display:` rule that is also toggled by the
`hidden` property needs a matching `[hidden]{display:none}` override — has now shipped as a bug
**four times** in this repository, twice before the squad arrived. `app/test/page.test.js` exists to
catch it. It did not catch either of this build's two occurrences.

The guard iterates a hardcoded array of eleven class names. `.btn` and `.joinpanel` were not in it,
because nothing had ever toggled them with `hidden` before this build did. The test passed on a
page carrying two live instances of the exact bug it was written for. Both were found by a browser
assertion in QA's suite instead.

**Why it is systemic.** A guard whose scope is a manually maintained list only ever covers what
someone remembered to add, and the failures it exists to catch are by definition the ones nobody
anticipated. It reads as coverage and is a checklist. The same shape appears anywhere a test
enumerates rather than derives.

**The fix.** `agents/qa.md` needs a rule: a guard against a class of defect must **derive its
subjects from the artefact**, not from a list beside it. Here that means parsing the stylesheet for
every selector carrying a `display:` rule and asserting an override for each, so a new class is
covered the moment it is written. Where derivation is genuinely impossible, the test must assert
the size of its own list so that adding a subject without adding a case fails.

---

## 27. workshop-hub-room-runner — a shared enumeration is indexed by suites nobody runs — MEDIUM

**What happened, and what stopped it.** This build removed one entry from `ROOM_STAGES`, the running
order every screen and all three Playwright suites index into. The pipeline runs only the current
build's suite, which is how build 2's suite sat red across two builds (learning 19's neighbour).

This time it did not break, and the reason is worth keeping: the **Surveyor** recorded in §6 that
three suites index into that enumeration, and the **Architect** turned that into a mandatory clause
in the contract's §4 test strategy — *QA runs all three*. QA found four coupled assertions in build
2's suite and one shared helper that every spec in two suites depends on, and fixed them as
`changing` bindings.

**Why it is worth a rule anyway.** It worked because one survey happened to look. Nothing required
it to. `agents/surveyor.md` §6 should require naming any enumeration or fixture **more than one
test suite depends on**, and `agents/architect.md` §4 should require the test strategy to say which
suites run when a named shared dependency changes. Otherwise the next build's survey may not think
of it, and the failure is silent — a red suite nobody executes.

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

## What worked in build 3 and should not be changed

- **A prior decision made this build nearly free.** ADR 0005 (the database constrains shape, the
  rulebook constrains values) was written in build 2 to repair the stage machine. Because of it, this
  build needed **no migration, no table, no column and no policy** — the lifecycle rode the existing
  append-only log. The Architect checking whether an existing decision removes work, before designing
  new storage, is worth more than any process step in this file.
- **Deriving rather than storing.** The lock is `close_time + 20 minutes`, computed identically on the
  server and in the page, with nothing stored and no scheduled job to flip a flag. One constant in the
  rulebook is the whole configuration surface.
- **Failing open, deliberately and in writing.** The gate returns "not locked" on any read failure,
  and both the ADR and the security review state why: the cost of failing closed is a room of fifteen
  people locked out mid-workshop. QA asserts the fail-open path explicitly, so it cannot be
  "tidied up" later by someone who reads it as a bug.
- **Translating one status code once, at the fetch layer.** Six write paths show the right sentence
  for a locked session without any of them learning what 403 means.
- **The security review naming what the feature does *not* enforce.** The lock reads like a security
  boundary but is enforced by the routes, not the database; saying so plainly in 5a and again in 5b
  is what stops the next reader trusting it further than it deserves.

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

## What worked in build 5 and should not be changed

- **Preflight deferring a known blocker instead of halting.** The Vercel block was recorded at
  Stage 0.5 as *blocking, deferred by Orchestrator decision*, and the run continued to
  security-green. The block then cleared on its own before Stage 6. Halting at 0.5 would have
  produced nothing while waiting on something outside the repository.
- **Making the new state a phase rather than a column.** The lobby cost one array entry and no
  migration, because `roomStageIndex` returns -1 for it and every guard already written as *nobody
  gets ahead of the facilitator* refused every stage for free. Second build running to get a whole
  feature out of ADR 0005.
- **Keeping the default for a room with no rows.** `firstPhase('room')` deliberately did not move to
  the new first phase, so sessions created before the build behaved exactly as before. The
  temptation to let array order decide it would have locked live workshops out of their own day.
- **Deciding two things in the contract and saying "made not asked".** The review-moves-the-projector
  rule and the never-disabled Initiate were written into `/state/tasks.md` at intake with their
  reasons. No later stage re-opened either.
