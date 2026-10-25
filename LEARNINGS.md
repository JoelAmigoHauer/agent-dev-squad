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

---

# Build 2 — learnings from client-portal (2026-09-11)

Second end-to-end run. Deployed to `methodworks-portal.vercel.app`. One high-severity latent bug
reached production and was caught in the Stage 6 smoke test; the rest is tooling reality.

## B2-1. An admin-client RPC in a non-exposed schema is unreachable, and fails closed — HIGH

**What happened.** The rate limiter's `bump_rate_limit` was placed in the `private` schema (0005),
for the same instinct 0003 used to hide the RLS helpers: keep it off the REST surface. But the admin
client (service role) reaches Postgres **only through PostgREST**, and PostgREST exposes only
`public` + `graphql_public`, so `.schema('private').rpc('bump_rate_limit')` returned `PGRST106
Invalid schema: private`. `consume()` fails closed, so every unauthenticated route answered 429 and
nobody could request a magic link. Sign-in, the only way in, was dead. It shipped because the
pre-deploy verify harness ran without a service key, so the two admin-client paths (magic-link,
retention) were logged as "still need the service key" and never actually exercised.

**Why it is systemic.** Two roles reach the DB with different surfaces: the request-scoped client
(anon/authenticated) and the admin client (service role, still bound by PostgREST's exposed-schema
list). "private hides it from clients" is true for the first and a false mental model for the second.
`bypassrls` skips policies, not schema `USAGE` or function `EXECUTE`. And a fail-closed limiter turns
a reachability bug into a silent, total auth outage that only shows on first real use.

**The change.**
- `agents/engineer.md`: an RPC the admin client calls lives in an **exposed** schema (`public`),
  locked to `service_role` by grant — never hidden in `private`. State that `bypassrls` is not
  schema `USAGE`/`EXECUTE`.
- `agents/qa.md`, `agents/security.md`: the verify harness must run the **service-role paths against
  the hosted project with a real service key** before Stage 6 — a magic-link 200 that writes a
  `rate_limit_hits` row, and retention end to end. A path that "still needs the service key" is
  unverified, not deferred.
- `agents/devops.md`: the Stage 6 smoke test must include one **service-role write path end to end**,
  not just "app loads + access refused." The fix here was migration 0019 (a service-role-only
  `public.bump_rate_limit` wrapper) plus one line in `rate-limit.ts`.

## B2-2. First deploy of a new Vercel project is production, and the built-in connector can't create it — MEDIUM

**What happened.** The built-in Vercel connector could list/read/deploy but 403'd on
`create_git_project` and `update_project`; Composio's admin Vercel connection had the rights. No
connector sets env vars for a git-linked project except at creation, so env is set in the create call
or in the dashboard. Vercel also sends a new project's first deployment straight to production.

**The change.** `skills/deploy-sequence.md`: for a second project in an existing repo, create it
git-linked with `rootDirectory` and the full env in one call, scope SSO to **preview** so production
is public, and record that deploy one has no rollback target. Note the connector-vs-Composio
permission split as a dated tooling fact.

## B2-3. Magic-link sign-in needs Supabase Auth URL config that no connector exposes — LOW

**What happened.** Beyond the code, sign-in needs the Supabase Auth **Site URL + redirect allowlist**
pointed at the deployed origin, or a sent link redirects to the default localhost. No MCP or Composio
tool exposes it.

**The change.** `skills/deploy-sequence.md`: add "set Supabase Auth Site URL + redirect allowlist to
the production origin" as an explicit owner-side step for any magic-link build, and have the deploy
record carry it as a remaining item until confirmed.

---

# Build 2, second harvest — client-portal v1, amendment set 2 to the close (2026-09-28)

Stage 7's second pass over `client-portal`, whose first harvest is B2 above. It covers everything
after deploy 1: amendment sets 2 to 7 (A14 to A81), QA passes 2 to 7, 5a's second to fourth passes,
the merge to `main` on 2026-09-22, deploy 2, Stage 6's verification of 2026-09-28 and 5b's pass the
same day. Numbered `B3-` so the two harvests of one build stay apart. B3-4 is B2-1 recurring,
because B2-1's change could not reach this build; B3-11 corrects B2-2.

Citations: `tasks.md` is `.squad/state/tasks.md`; every other file named is in
`.squad/builds/client-portal/`. Paths in THE CHANGE are the template's.

## B3-1. client-portal — The contract bound how state is used and never how it comes to exist

WHAT HAPPENED: After deploy 1, a discovery pass found the 23-table model received inserts from three
places only. Orgs, engagements, seats and guarantee periods had "no creation path at any layer": the
portal could manage clients it could not create, every stage had done its job, and "the gap reached
production, because nothing ever bound it" (contract.md:1957-1969). It was one case of a class met
at least a dozen times. Nothing created a `profiles` row or claimed a seat (build-notes.md:256-263);
nothing seeded either gate, so both read 0 of 0 forever (contract.md:1874); three config tables had
no seed (A37, contract.md:2715-2724); six `sessions` kinds could not be written (A35); four columns
had no writer (A41, contract.md:2947-2954), and neither did `seats.left_on`, `supervised_by`,
`prompt_assignments`, the consent's disclosure text and removal date, or `devices.facts` (A32, A47,
A51, A56, A57; tasks.md:120). Where the writer sat outside the build, the flow shipped empty: the
Sanity document types live in `starboard/`, which §1.1 put out of bounds, so `/prompts` and
`/resources` show their empty states in production (deploy-record.md:345-353), and the 35 original
gate items are still "the oldest open item" (contract.md:4749).

WHY IT IS SYSTEMIC: `agents/architect.md` § Flow bindings makes a flow that exists drivable. It
cannot make a missing flow visible, and § 2. Data model declares columns with no field for what
writes them, so a comment ("seeded per engagement", "set by staff at close") reads as a writer. Each
stage verifies what is bound, so the gap passes all of them. It is build 1's critical defect one
level up: build 1 had a flow with no binding between its halves, this build had flows with no
binding at all (contract.md:1971-1974). Any build whose entities are created by staff, a trigger, a
seed or another system meets it.

THE CHANGE:
- `agents/architect.md` § Output contract gains a mandatory **writer table** beside § 2. Data model:
  for each table, and each column its own insert does not set, what creates it (a flow row, a
  trigger, a seed migration or an external owner), what changes it and what ends it. An empty writer
  cell fails § Validation pass. An external writer names its owner and whether it sits inside the
  build's boundary; a MUST flow whose writer is outside is flagged at Stage 1, not found at Stage 3.
- `builds/_template/contract.md` scaffolds the table.
- `agents/qa.md` § Static checks: enumerate every `.insert`, `.upsert`, `.update`, trigger and seed
  in the app and diff them against the writer table, the method that found the provisioning spine
  missing (contract.md:1957-1960).

SEVERITY: critical

## B3-2. client-portal — An amendment set got no stage lines, so an unbuilt set was invisible and reached `main`

WHAT HAPPENED: Amendment set 6 (A66 to A78) was appended on 2026-09-13 and designed in batch 9, and
no line in the state block ever read `stage-3-engineer: pending` for it. A79 and A80 took the
Engineer, the resume rule found no stage undone, and v1 reached `main` on 2026-09-22 with A68's
database half, A69 and A71 to A76 unbuilt (tasks.md:64, :988-993). Both gates were green over it:
`flows/09-take-on-spine.spec.ts:135` still asserts A53's "there is no Decline in v1" (tasks.md:64),
and 5b re-measured FINDINGS 5, 6 and 7, the three 5a findings set 6 ruled on, as still open in
production (security-review.md:1670-1672). v2's Surveyor found it (tasks.md:985). Set 2 had the
mirror-image miss: "written, built by Stage 3 as 'IT panels', and never designed"
(contract.md:3496-3497), and its undesigned `precheck` route applied a pasted machine reading with no
person's action (tasks.md:116). Deploy 2's Stage 6 was `running` only in a prose note
(tasks.md:916). A container restart killed it before it wrote, nothing re-fired it, and production
went unverified for 5 days 9 hours (deploy-record.md:104-107, :284-302).

WHY IT IS SYSTEMIC: `CLAUDE.md` § Conflict resolution says an amendment that moves the data model or
an API shape means QA regenerates, "and it is your job to fire that". It says nothing of the
Designer or the Engineer, and nothing about recording the obligation. The resume rule reads stage
lines only, so a duty held in prose, in an amendment's QA column or in the Orchestrator's memory
does not exist for it. Any build that amends more than once has one set in flight while another
holds the stage.

THE CHANGE:
- `CLAUDE.md` § State protocol: when an amendment set is appended, the Orchestrator writes one
  `pending` line per stage it routes to, naming the set: Designer if it adds or changes a surface or
  control, Engineer always, QA if it moves the data model or an API shape. Status lives only in the
  block; a note may explain a line, never stand in for one. A stage killed by a restart is written
  `halted — container restart` at once and re-fired before other work.
- `CLAUDE.md` § Conflict resolution: its last paragraph points at that routing rule.
- `agents/architect.md` § Handling clarification requests from downstream: each amendment set's
  summary table gains a `Routes to` column, so the pending lines are copied, not inferred.
- `agents/devops.md` § Sequence, step 1: no merge or deploy starts while a `pending` line names an
  amendment set.

SEVERITY: critical

## B3-3. client-portal — There was no test environment, so every test, fixture and migration ran on production

WHAT HAPPENED: Every QA pass ran against `qpvvkckmurvwgisbuceo` (test-results.md:4-5), the project the
live app reads (tasks.md:218). Preflight had recorded the answer on day one: Pro "restores
branching", so "QA gets an isolated database per build without Docker" (preflight.md:10, :72-73,
:124-125). No branch was ever made (tasks.md:242). What followed, all on production:
- runs left their rows, orgs went 26 to 54 to 106, and seven reds were the suite failing on its own
  residue (tasks.md:278-279, :302), because cleanup needs port 5432 and it is blocked here
  (tasks.md:253);
- a restart stopped QA between `cleanup.sql` and `fixture.sql` and left production with no orgs
  (tasks.md:307-308);
- FINDING 17: the fixture's staff account, `is_mw_staff` true, is on production with ten sessions
  that never expire, 13 days after its run, and is "a precondition of the first client invite"
  (security-review.md:1788-1849). FINDING 11: five production session credentials reached git
  history from `tests/.auth/` (security-review.md:983; tasks.md:130);
- Stage 3 applied 0020 to 0031 there from 2026-09-12, while production kept serving code that selects
  `level_consents.answered_by`, which 0024 renamed, so that deployment is no longer a rollback target
  (deploy-record.md:119-128, :272-279);
- every preview carries production's database URL and keys, the service-role key included
  (deploy-record.md:265-268; tasks.md:951).

WHY IT IS SYSTEMIC: `agents/qa.md` § Test data — local Supabase stack requires a local stack and
"Docker must be running", with no fallback, and Docker never runs in this container class
(ERRORS.md fact 2). Preflight named the fallback, but `CLAUDE.md` § Context loading rule gives QA its
agent file, the contract and the state file, never `preflight.md`, so a degraded capability's
fallback reaches only the stage that wrote it down. In a brownfield build the hosted project is
production from day one, so without a bound test target every such build tests on production.

THE CHANGE:
- `agents/architect.md` § Output contract: a mandatory `TEST TARGET:` field (local stack, Supabase
  branch or separate project), never the project a production deployment reads. Preflight's
  degraded rows are Architect inputs, so a fallback reaches every stage through the contract.
- `agents/qa.md` § Test data: the fallback order when Docker is down (branch, then separate project,
  else halt as blocking); a fixture that refuses to run where a non-fixture org exists
  (security-review.md:1845-1848); the auth-state directory gitignored before the first run.
- `agents/engineer.md` § Definition of done for your stage: migrations go to the test target;
  production gets them at Stage 6, with the code that expects them.
- `skills/deploy-sequence.md` § 1. Wire environment variables: preview and development point at the
  test target, never at production's database or service-role key.

SEVERITY: critical

## B3-4. client-portal — The first retro's changes could not reach the rest of the build, and deploy 2 shipped the gap B2-1 describes

WHAT HAPPENED: B2-1 (2026-09-11) said a path that "still needs the service key" is unverified, not
deferred, and that Stage 6's smoke test drives one service-role write end to end. The stage files
this build ran under stayed as stamped (`.squad/VERSION`, 2026-09-09; `agents/qa.md` and
`agents/devops.md` unchanged since), because Mode 1 forbids editing them mid-run, and no brief
carried the rule instead. In every QA pass from 2 to 7, seven tests skipped for want of
`SUPABASE_SERVICE_ROLE_KEY` (test-results.md:520-533, :1823), and the harness and every pass skipped
"A28 the send itself" (deploy-record.md:325-330). Deploy 2's Stage 6 drove no write path
(deploy-record.md:225-230), and the invite fix deploy 2 existed to ship has never run with a service
key anywhere (deploy-record.md:325-339). Deploy 1 had carried the same flow, dead for a different
reason, past Stage 6 as an open follow-up (contract.md:2068-2070).

WHY IT IS SYSTEMIC: Stage 7 runs "after deploy", and `CLAUDE.md` § Two modes of work freezes
`agents/` and `skills/` for the rest of the run. A build that deploys more than once, as this one
did over nineteen days and seven amendment sets, runs its second half under rules its first retro
already proved wrong. Separately, `agents/qa.md` lets a credential-shaped skip print its reason and
pass, so a §1.12 flow can go unexercised through every pass under a green verdict.

THE CHANGE:
- `CLAUDE.md` § Two modes of work, Mode 1: when Stage 7 runs mid-build, each entry whose change
  targets a stage file becomes a standing clause in the state block for that stage, carried in every
  later brief to it until the build closes. The file stays frozen; the rule does not wait for it.
- `agents/retro.md` § What you produce: a mid-build entry adds `BINDS THIS BUILD: <stages>`.
- `agents/qa.md` § Silent passing is banned: a skip on a §1.12 flow for a missing credential is
  reported `blocked`, and blocks Stage 6 until the credential reaches the harness or Joel accepts the
  gap in writing.
- `agents/devops.md` § Sequence, step 8: Stage 6 does not close while any §1.12 flow has never run
  end to end in any environment; the deploy record lists each one.

SEVERITY: critical

## B3-5. client-portal — The contract stated premises about code, consumers and third parties that nobody had read

WHAT HAPPENED: Five clauses stated facts nobody had checked, and each held until a stage built or
tested on it:
- A28: the invite called `signInWithOtp` with `shouldCreateUser: false`, so GoTrue sent nothing to a
  new address while the route answered `{ sent: true }`: "the flow has never worked and could not
  have worked" (contract.md:2064-2070).
- A36: §1.11 relied on a `SANITY_API_READ_TOKEN` that never existed, so `/prompts` and `/resources`
  could never render, because "a stated assumption in a binding contract reads as a fact"
  (contract.md:2649-2659; tasks.md:84).
- A77: A32's admin-API sign-out takes the user's own JWT, which a staff route must not hold, and
  A29's `layout: 'flat'` would insert a row the CHECK refuses (contract.md:4667-4700). A25: A18's
  consent enum was invented, then replaced by the consumer's when `ci_level.py` was read later the
  same day (contract.md:1848-1852).
- A80 made two false statements about `middleware.ts`, corrected in place after QA disproved one by
  attempt (contract.md:4917-4925, :4942; tasks.md:191, :193).
- Deploy 1's record filed custom SMTP as "recommended". Supabase's docs, read 2026-09-28: without it,
  auth mail goes only to the project team's addresses, two an hour, so no invite can reach a client
  (tasks.md:939-947; deploy-record.md:340-344).

WHY IT IS SYSTEMIC: `agents/architect.md` § When to flag versus when to decide says to decide and
"state the assumption in the spec", and nothing marks a stated assumption as unverified, so
downstream it binds like any other clause. The rule that caught two of these, verify a named
third-party call before its shape is bound, exists only inside A77 (contract.md:4697-4700;
tasks.md:148). Every build names third-party calls, credentials and platform limits.

THE CHANGE:
- `agents/architect.md` § 1. Written spec: a clause stating a fact about existing code, an external
  consumer, a credential, a third-party call or a platform limit cites where it was read (file and
  line, or URL and date). The rest go in an `Unverified premises` table, each owned by the first
  stage that depends on it.
- `agents/engineer.md` § Guardrails: before building on an unverified premise, verify it (docs and
  one probe) and route a mismatch as a `CLARIFICATION`, never an approximation.
- `skills/deploy-sequence.md` § 0. Preconditions: a build that emails anyone outside the Supabase
  project team sets custom SMTP before its first send (built-in mailer: team addresses only, two an
  hour, as at 2026-09-28).

SEVERITY: high

## B3-6. client-portal — The contract grew by appending until no stage could read it whole, and stale copies stayed in its binding tables

WHAT HAPPENED: `contract.md` went from 873 lines at Stage 1 (tasks.md:371) to 5,342, through 81
amendments appended at the bottom. Superseded rules stayed where stages read them. §1.6's table
still carried words A1 had replaced (contract.md:2151). Screens 9 and 10 and two set-1 flow rows had
been superseded "without ever reaching the table" (tasks.md:49). Thirty-one route sketches restated
a refusal ladder A80 had since moved, and one of them, §3.4's invite row, contradicted A79
(contract.md:5099-5103; tasks.md:59). A67's sketch, copied literally, would have shipped a 32nd
instance of the collapse A80 had just closed (tasks.md:210). A single-pass Engineer told to read the
contract, then 4,003 lines, with `design.md` and `build-notes.md` stalled for 69 minutes with no
output (tasks.md:106), and from then on stages were briefed with grep-and-sed extracts
(tasks.md:107, :182).

WHY IT IS SYSTEMIC: `CLAUDE.md` § Conflict resolution appends every amendment at the bottom, and §
Context loading rule loads the contract whole. Together they make the contract a log that every cold
reader must replay, and each amendment leaves one more stale copy in the body. The ladder moved
twice in one day (A79, A80), and everything restated beside it drifted.

THE CHANGE:
- `CLAUDE.md` § Conflict resolution: an amendment also edits the clause or table row it supersedes,
  in place, struck through with a pointer (`superseded by A<n>`). The appended amendment keeps the
  reasoning; the body stays current. A67 and A81 did this by hand.
- `agents/architect.md` § 3. API contract: a route sketch names only the statuses specific to that
  route and never restates the common error shape (A81, contract.md:5089-5118).
- `CLAUDE.md` § Context loading rule, item 2: past 1,500 lines, a stage loads the sections its brief
  names, extracted by heading, with every amendment that supersedes them.

SEVERITY: high

## B3-7. client-portal — Checks that could not fail were read as evidence

WHAT HAPPENED: In three stages and the Orchestrator, a green or a refusal was taken as proof before
anyone showed it could have come out the other way:
- `api/01-auth.spec.ts:62`, the only test sending no session to a staff route, asserted 403 and
  passed, so it "pinned the defect rather than catching it". §3 had specified 401 all along, and
  production served the collapse from deploy 1 (test-results.md:685, :701; tasks.md:190;
  deploy-record.md:165).
- `verify/http/assert.sql` asserted that `precheck` had written `facts_stage`, which was the A54
  breach: "the harness tested that the bug worked" (tasks.md:119).
- Two assertions sat behind `if (!wasConfirmed)` and silently did not run (tasks.md:137), and
  `flows/10:58` matched the wrong element and stayed green, "the fourth
  test-passing-for-the-wrong-reason in two days" (tasks.md:221, :232).
- `has_column_privilege` answered true for columns two migrations claimed to revoke, and "read as
  confirmation", so a self-promotion to staff survived both (build-notes.md:173-185).
- Three passes, by 5a and the Engineer, read CHECK constraints, unique indexes and a disclosure FK
  as tenancy guards until a matched same-org control showed otherwise; 5a's fourth pass caught six
  of its own (tasks.md:273, :296, :337).
- The Orchestrator called deploy 2 READY on a `307` the previous build also returns (tasks.md:909).

WHY IT IS SYSTEMIC: LEARNINGS 7 bans silent passing: report what ran. It does not ask whether the
check could have failed. A test written beside the code, a refusal with two possible causes and a
smoke assertion both builds pass all show execution and prove nothing, and every stage that
verifies uses one of the three.

THE CHANGE:
- `agents/qa.md` § Test generation: a new or regenerated test counts once it has been shown red
  against the defect, by the unfixed binary or an inverted expectation. No assertion sits behind a
  condition, exact matchers beat presence, and a locator is shown to resolve the intended element.
  Pass 5's green guards against over-reach are the model (tasks.md:188).
- `agents/security.md` § Manual checks and `agents/engineer.md` § Definition of done for your stage:
  a refusal proves a guard only beside a matched control that the legitimate write passes, and a
  privilege is proven by attempting the write as the role, never by `has_*_privilege`.
- `agents/devops.md` § Sequence, steps 6 and 8: each smoke assertion is marked discriminating or
  liveness, and at least one discriminating assertion is shown failing on the previous deployment,
  as deploy 2's record did (deploy-record.md:158-170).

SEVERITY: high

## B3-8. client-portal — Supabase's default grants undid column revokes and handed out TRUNCATE, three times in one build

WHAT HAPPENED: 0002 and 0006 "revoked" column updates that Supabase's table-level `grant all` to
`authenticated` still allowed, so any signed-in user could make themselves staff through
`/rest/v1/profiles` (build-notes.md:148-167). 0007 revoked the table-level UPDATE instead, and since
staff are `authenticated` too, that broke every staff write to those columns, "never smoke-tested
with a staff session" (contract.md:1882-1886), until 0015 and 0027 put the writes behind definer
functions (tasks.md:111). GAP 10 then found `anon` and `authenticated` holding TRUNCATE, which RLS
never filters, on 27 of 30 tables, handed to every new table by the default ACL
(test-results.md:474-502; tasks.md:316, :320). The three clean tables were clean because two
migrations happened to write `revoke all` by hand (tasks.md:331).

WHY IT IS SYSTEMIC: Every Supabase project starts with table-level grants to `anon` and
`authenticated` and a default ACL that repeats them for each new table, and one Postgres role serves
every signed-in person, staff included. None of this is in `agents/engineer.md`, so each build meets
it one table at a time. Build 1's advisor findings (LEARNINGS 3) came from the same machinery.

THE CHANGE:
- `agents/engineer.md` § Platform notes for the default stack: the first migration revokes the
  table-level grants from `anon` and `authenticated` and alters `postgres`'s default privileges; each
  table then grants only what its policies need. A column revoke is void under a table grant. Staff
  writes to client-locked columns go through a `security definer` function that checks
  `is_mw_staff()`.
- `agents/security.md` § Manual checks, Auth: a standing query of every role's privileges on every
  `public` table, plus a table created after the migrations that must come out without TRUNCATE
  (tasks.md:328). 5b runs both against production.

SEVERITY: high

## B3-9. client-portal — A foreign key proves a row exists, never that it is yours

WHAT HAPPENED: A47 found `seats.supervised_by` accepting a supervisor from another client's
engagement. A55 found the same shape on `given_by` and set the test: if a third appears, the pattern
is the finding (tasks.md:100). 5a found five more, two writable by an ordinary client and one with a
read path that would render another client's task text (tasks.md:123). A66 ruled the class with a
register and found an eighth (tasks.md:143). The register was then ruled and not built: 5a's third
pass wrote a cross-tenant `seat_requests.seat_id` as a client against the production database
(FINDING 9, security-review.md:923; tasks.md:267), closed the same day by 0030 (tasks.md:291).
Building it showed both earlier guards fired in one direction only, so a seat could be moved out
from under a supervision or a consent (tasks.md:295).

WHY IT IS SYSTEMIC: In a multi-tenant schema, a row that references two tenant-scoped rows can join
two tenants, and neither the FK nor the referenced table's RLS refuses it. `agents/architect.md` §
2. Data model asks for "the row-level security intent for each table" and nothing about references
between tenant-scoped rows, so each instance surfaces one column at a time.

THE CHANGE:
- `agents/architect.md` § 2. Data model: a multi-tenant contract carries a tenant-reference
  register, listing every column that references a tenant-scoped table, the row it anchors to and
  its guard (A66, from contract.md:4067).
- `agents/engineer.md` § Guardrails: a new tenant reference ships in one migration with its register
  row, its guard (one register-driven function, anchor-and-references, both directions,
  tasks.md:293) and a refusal test with a matched same-tenant control.
- `agents/security.md` § Manual checks: 5a re-derives the register from `pg_constraint`, not from
  the contract, and attacks each row (tasks.md:336).

SEVERITY: high

## B3-10. client-portal — Platform settings contradicted contract clauses, and no advisor or scanner could see them

WHAT HAPPENED: §1.3 made the absence of a public signup route a clause. The app complied and the
project did not: `disable_signup` was false, unauthenticated signups reached the mailer, and the
account-enumeration oracle closed in the app at FINDING 1 re-opened one layer down (FINDING 3,
blocking, security-review.md:278-304; tasks.md:122). 5b found two more of the kind, and "neither is
visible to any advisor or scanner. Both came from reading the platforms' own settings beside the
code" (security-review.md:1909-1913): FINDING 16's protection scope (B3-11) and FINDING 17's sessions
that never expire (`sessions_timebox` 0). Leaked-password protection is off, the minimum is six
characters, and the one real staff account has no MFA factor (FINDING 14, security-review.md:1677).
The advisor route in use is SQL-scoped and drops the auth lint, whose absence looked like a fix
(security-review.md:1555, :1876-1878). npm audit, semgrep and gitleaks were clean on every pass,
including those that found an open redirect and an unbuilt tenancy register (tasks.md:340, :748).

WHY IT IS SYSTEMIC: `agents/security.md` rests on advisors, scanners and a code review. A hosted
setting is neither code nor a lint, and the contract binds the app without binding the settings that
can override it. Supabase and Vercel both ship auth and protection settings that default open.

THE CHANGE:
- `agents/architect.md` § 1. Written spec: a `Platform settings` table binds every setting a clause
  depends on, with its required value (for Supabase: `disable_signup`, `mailer_autoconfirm`,
  `password_hibp_enabled`, `password_min_length`, `sessions_timebox`, `smtp_host`, `site_url`,
  `uri_allow_list`; for Vercel: the deployment protection scope).
- `agents/security.md` § You run twice: 5a and 5b read each bound setting from the platform's API
  and compare it with the table, and the SQL advisors are never the auth check. 5b also hashes the
  deployed function bodies against the migration files (security-review.md:1694-1700). § Second pass:
  the scanners are a floor, and the verdict names which findings came by attempt.

SEVERITY: high

## B3-11. client-portal — On a git-linked project the merge is the promote, and B2-2's protection scope left every old production deployment public

WHAT HAPPENED: Deploy 2 was the fast-forward push of `main`, on the Orchestrator's recommendation
and Joel's call (tasks.md:876, :988). A preview of the same SHA went READY 14 seconds earlier and was
never smoke-tested (deploy-record.md:390-394; tasks.md:981), and Stage 6 was fired after production
moved, to verify only (tasks.md:916). B2-2 prescribed scoping Vercel SSO to `preview`. Vercel now
documents that scope as legacy, protecting "only preview URLs", so all 30 superseded production
deployments stay public and 22 still serve FINDING 8's sign-in redirect (FINDING 16,
security-review.md:1732-1785). Twenty-one of those 22 were rebuilt by commits that never touched
`portal/` (security-review.md:1755-1758). Next 16's `next build` runs no lint, so "CI: passed"
carried no lint evidence (deploy-record.md:138-141). Two variables made available 66 and 80 seconds
after a preview build did nothing to it, which Joel met as "Too many attempts" (tasks.md:281-282).

WHY IT IS SYSTEMIC: `skills/deploy-sequence.md` models a deploy as preview, verify, promote. On a
git-linked project the merge to `main` is the promote, and whoever merges deploys, whether Stage 6
is running or not. Every project rooted in a subdirectory of a shared repository rebuilds on every
push to it, and B2-2 as written carries the legacy scope into the next build.

THE CHANGE:
- `skills/deploy-sequence.md` § 5. Smoke test the preview and § 6. Record the rollback target, then
  promote: on a git-linked project, smoke-test the preview of the exact SHA to be merged; the merge
  is the promote and happens only with Stage 6 `running`. A rollback target older than an applied
  migration is recorded as unsafe (deploy-record.md:119-121).
- `skills/deploy-sequence.md` § Platform notes, correcting B2-2: protection is Standard Protection
  (`prod_deployment_urls_and_all_previews`), with the production alias confirmed public, and a
  project rooted in a subdirectory gets an Ignored Build Step on it. § 1: after a variable change,
  redeploy and confirm the deployment is newer than the change.
- `agents/devops.md` § Deploy record: the CI line lists each check that ran.

SEVERITY: high

## B3-12. client-portal — Status codes and bodies that did not say what happened

WHAT HAPPENED: Handlers ended in `return forbidden()`, so a malformed id (22P02) answered 403 on
twelve routes (A79, contract.md:4770-4786; tasks.md:149-150), and an `undefined` argument that JSON
drops answered a flat 403 naming nothing (tasks.md:112). `getStaffCaller()` returned null for both
"no session" and "not staff", so none of 31 staff routes could return the 401 §3 had always
specified: "The code was never missing. The seam could not produce it" (contract.md:4938). The
config route answered `200 { saved: true }` having written nothing (GAP 9, tasks.md:162-163), and
deploy 1's invite answered `{ sent: true }` with no email sent (contract.md:2064-2068). On the
client, 33 fetch calls cast their own bodies and none imported the error union, so a daily-cap 429
read as "wait a minute" (tasks.md:175, :186). The class ran through all three QA↔Engineer iterations
and two amendments.

WHY IT IS SYSTEMIC: A catch-all branch spreads by copy; the same line sat on 15 routes
(tasks.md:127). A seam that returns one value for two facts makes every caller wrong at once.
`agents/engineer.md` has no guardrail on either, and `agents/architect.md` § 3. API contract asks
for status codes per route with no order to apply them in.

THE CHANGE:
- `agents/engineer.md` § Guardrails: one shared entry point per caller class owns the order 401,
  400, 403, 404, then 500 with no detail for any database error the route does not translate.
  `forbidden()` is never a fall-through. Every update and delete checks its affected count, and zero
  is 404, never success. The client reads the same error union through a type-only import. A80's
  `requireStaff()` door and `lib/mutate.ts` are the worked pattern (tasks.md:197-198).
- `agents/architect.md` § 3. API contract: the common error shape states that order once.

SEVERITY: medium

## B3-13. client-portal — Three builds shared one state file, and it stopped being safe to edit

WHAT HAPPENED: The `website` build, started 2026-09-19 on `main`, replaced client-portal's 744-line
block with its own, although "only one build runs at a time"; the 2026-09-22 merge kept both
(tasks.md:15-21, :889-900). By 2026-09-28 the file held three builds in 1,029 lines. Entries landed
inside a sentence (tasks.md:326-342), after a closing fence (tasks.md:259) and out of date order
(tasks.md:252). An edit aborted on an anchor that matched twice and the commit ran anyway, so
`ec09a66` claims a change it does not carry (tasks.md:1026-1029). The Orchestrator recorded the fix
for Stage 7: one state file per build (tasks.md:901-903).

WHY IT IS SYSTEMIC: `CLAUDE.md` § Run order forbids a second concurrent build and nothing enforces
it: the file has one `## Current` slot and no lock, so a build run from another branch overwrites
the first when the branches meet. At this size, edits by anchor are fragile, and the resume rule
reads a file nobody can hold whole.

THE CHANGE:
- `CLAUDE.md` § State protocol and `state/tasks.md`: one state file per build,
  `state/<app-name>.md`, holding the stage block and escalations only. Dated notes go to an
  append-only `builds/<app-name>/log.md`. § Run order's one-build rule becomes one build per file.
- `CLAUDE.md` § State protocol: a state-file edit anchors on a unique line and the commit is chained
  to it, so a failed edit never ships a commit message.

SEVERITY: medium

## B3-14. client-portal — What counts as a loop iteration was ruled three times mid-run

WHAT HAPPENED: With the QA↔Engineer loop at 2 of 3 and ten new findings, the Orchestrator ruled that
the loop should "close at 3 rather than halt at 3", and Joel agreed (tasks.md:152, :44). 5a then
reported the Security cap consumed by counting its own review passes; the Orchestrator ruled that an
iteration is a round trip, and that the Engineer had never fixed a 5a finding (tasks.md:264-265).
Regenerations after amendments and QA's repairs to its own tests were each ruled "not an iteration"
separately (tasks.md:40-41, :62, :213).

WHY IT IS SYSTEMIC: `CLAUDE.md` § Loop caps defines the caps and the environmental exemption and
never defines an iteration, so each stage counted what it could see. A cap nobody counts the same
way gets renegotiated at the moment it bites.

THE CHANGE: `CLAUDE.md` § Loop caps: an iteration is one round trip on a finding (the stage reports,
the Engineer changes code, the stage re-checks). Not an iteration: a review pass with no code
change, a regeneration after an amendment, QA repairing its own test, an environmental rerun. State
whether the Nth iteration halts, or only a finding that survives a fix. Mirror it in `agents/qa.md`
§ The fix loop and `agents/security.md` § The fix loop.

SEVERITY: medium

## B3-15. client-portal — Stages shared one working tree, and the Orchestrator committed under running stages

WHAT HAPPENED: The Orchestrator's `git add -A` swept QA's in-progress tests, three of them broken
intermediates, into checkpoint `abf8ca1`, which therefore does not reproduce QA's numbers
(tasks.md:129). It committed under a running Engineer twice more; the Engineer caught it and checked
that the binary it tested was still HEAD (tasks.md:153). QA and the Engineer had to run serially,
because the suite takes about 17 minutes and a parallel run "would measure a tree that does not
exist" (tasks.md:164, :183).

WHY IT IS SYSTEMIC: `CLAUDE.md` § Run order makes Stages 4 and 5a parallel and says nothing about a
stage that writes the tree while another measures it, and a fix loop always has a writer. ERRORS.md
fact 11 covers `git add -A` as a habit; the stage-level rule is missing.

THE CHANGE: `CLAUDE.md` § Run order: stages run in parallel only when at most one writes the tree
under test; a QA run never overlaps an Engineer pass; the Orchestrator commits by explicit path and
never while a stage is writing.

SEVERITY: medium

## B3-16. client-portal — The build changed an API shape outside an amendment, and no test could tell

WHAT HAPPENED: A copy change Joel asked for went straight to the Engineer, and `64da6ac` added
`takeOnStep` to `GET /api/staff/worklist` and replaced both of A49's `detail` strings. For eight days
the response and the contract disagreed and nothing went red, because the suite asserted only that
the kind appeared (test-results.md:39-55; tasks.md:298, :762-766). The next pass found an older drift
on the same route: `startsAt` and `endsAt` on three kinds, in no clause (GAP 11,
test-results.md:106-135).

WHY IT IS SYSTEMIC: A request that reaches the pipeline outside a stage goes to whichever stage can
make it, and nothing routes an API-shape change through the Architect. A suite that asserts fields
are present, rather than exact key sets, cannot see an addition.

THE CHANGE:
- `CLAUDE.md` § Conflict resolution: a change requested directly that alters a response shape, a
  status or a string the contract binds goes to the Architect as an amendment, before or with the
  Engineer's pass.
- `agents/qa.md` § Test generation: each response is asserted as the contract's exact key set, per
  kind, so an unbound field fails as drift.

SEVERITY: medium

## B3-17. client-portal — The flow binding table had no column for how a screen is reached

WHAT HAPPENED: Build 1's defect, a control and a route with nothing joining them, appeared five
times in this build (tasks.md:115). Stage 4's first pass found seven specified controls built as
routes and never wired (test-results.md:2374-2376). Other cases had a control nobody could reach: a
route whose only control sat inside an exception panel (tasks.md:97); `/staff/orgs/new`, the only
way to create an org, reachable only by typing its URL; and an in-force control unreachable after
its own flow's redirect (tasks.md:115). It stopped once QA walked every §1.12 row "starting from the
navigation and never a typed URL" (tasks.md:39).

WHY IT IS SYSTEMIC: `agents/architect.md` § Flow bindings binds screen, control, route and
post-condition, but not how the screen is reached or the state the flow starts from, so a row can be
satisfied by a page nobody can get to. `agents/qa.md` says flow tests drive the interface, not that
they start from the navigation.

THE CHANGE:
- `agents/architect.md` § Flow bindings: the table gains `Reached from`, the navigation path and the
  state in which the control is live.
- `agents/qa.md` § Test generation: a flow test starts from the app's navigation in that state,
  never from a typed URL.
- `agents/designer.md` § Output: a route whose only control sits inside an exception or error state
  has no control.

SEVERITY: medium

## B3-18. client-portal — Container restarts cost evidence wherever a stage wrote its record last or reset in two steps

WHAT HAPPENED: Three restarts hit running stages. The first killed the fix loop with its code on disk
and its record not, "because the Engineer writes its notes last", so a second pass had to rebuild
the evidence (tasks.md:42, :132). The second stopped QA between `cleanup.sql` and `fixture.sql`
(tasks.md:307-308). The third killed deploy 2's Stage 6 before it wrote anything
(deploy-record.md:106-107). A fourth, between stages, cost nothing, because every output had been
committed as it landed (tasks.md:208).

WHY IT IS SYSTEMIC: Restarts are routine in this environment and come without warning. A stage that
writes its record at the end, or resets in two scripts, has a window in which a restart loses the
evidence or leaves the database half-changed.

THE CHANGE:
- `agents/engineer.md` § Definition of done for your stage and `agents/qa.md` § Reporting gaps: the
  record is written as the evidence is produced, never at the end.
- `agents/qa.md` § Test data: a reset of more than one script runs as one transaction, or records a
  checkpoint before each script.

SEVERITY: medium

## B3-19. client-portal — Findings and briefs did not say how a claim was known

WHAT HAPPENED: QA's GAP 9 quoted `200 {"saved":true}` as a captured transcript. With the body as sent,
no run could have produced it: it was a correct deduction written as an observation, found only when
a test that should have passed after the fix did not (tasks.md:212; test-results.md:2222-2239). The
Orchestrator did the same three ways: it passed on a grep count of 47 as the size of an audit whose
real work was one assertion (tasks.md:189), described a merge conflict from `merge-tree`'s shape
rather than its content (tasks.md:884-887), and read the container's UTC clock as Sydney time
(tasks.md:246). Four of its briefs stated facts that were wrong: "the five pass" (tasks.md:133), two
fixture orgs rather than three (tasks.md:798), `HARNESS_PW` present (tasks.md:870), and a live
server on 3100 (tasks.md:260). Each stage caught the error only because its brief told it to check.

WHY IT IS SYSTEMIC: Stages and the Orchestrator write for readers who cannot re-run the work, and
neither the GAP block, the CLARIFICATION block nor the escalation format separates what was seen
from what was inferred. A correct inference is the hard case, because nothing looks wrong until
something relies on it.

THE CHANGE:
- `agents/qa.md` § Reporting gaps: the GAP block splits `OBSERVED` from `DEDUCED`, as the rewritten
  GAP 9 does (tasks.md:204).
- `CLAUDE.md` § Escalation format, and a new § Briefs: each figure or environment fact says how and
  when it was obtained (observed, counted, classified or deduced), a time is given in Joel's zone by
  computation, and a stage re-verifies an environment fact before relying on it.

SEVERITY: medium

## B3-20. client-portal — The spec tree sat outside the app's typecheck and module resolution

WHAT HAPPENED: The 32 spec files live under `builds/client-portal/tests/`, outside
`portal/tsconfig.json`, so the `tsc` gate never saw them (tasks.md:140), and every run died on
`Cannot find module '@playwright/test'` until `run.sh` exported `NODE_PATH`
(test-results.md:1827-1829).

WHY IT IS SYSTEMIC: `agents/qa.md` § Where things live puts every build's tests in the build folder,
outside the app's tsconfig and `node_modules`.

THE CHANGE: `agents/qa.md` § Scaffold it once per build: the spec tree gets its own `tsconfig.json`,
typechecked as a static check, and the runner sets `NODE_PATH` to the app's `node_modules`.

SEVERITY: low

## B3-21. client-portal — The contract and the design numbered the same screens differently

WHAT HAPPENED: `contract.md` §1.2 and `design.md` §10 gave the same screens different numbers and
neither said so; screens 16 to 19 agreed by coincidence (A52, contract.md:3416-3425).

WHY IT IS SYSTEMIC: Both files number screens on every build, and clarification requests cross
between them.

THE CHANGE: `agents/architect.md` § 1. Written spec and `agents/designer.md` § Output: a screen is
referred to by its path, and a number is a label local to one file.

SEVERITY: low

## B3-22. client-portal — Residency was bound for the data store and not for the functions

WHAT HAPPENED: §1.10 binds residency to the Supabase store in Sydney, and the functions run in
`iad1`, Vercel's default, so client data is processed in the US on every request
(deploy-record.md:395-399).

WHY IT IS SYSTEMIC: Vercel defaults functions to `iad1` and no stage file names the region, so a
residency clause written about the store leaves processing unbound on every build.

THE CHANGE: `agents/architect.md` § 1. Written spec: a residency clause binds the compute region as
well. `skills/deploy-sequence.md` § 0. Preconditions checks the function region against it.

SEVERITY: low

## B3-23. client-portal — The portal's database is shared with the marketing site, and the survey did not say so

WHAT HAPPENED: The hosted project carries a marketing-site migration with no local file, so the
schema cannot be reproduced in a second environment (tasks.md:109; deploy-record.md:125-126), and an
anon-callable definer function from that site has been FINDING 2 since 5a's first pass
(security-review.md:98, :1669).

WHY IT IS SYSTEMIC: A brownfield build often lands in hosted resources another app already writes
to, and `agents/surveyor.md` surveys code, not the other writers to what the build will share.

THE CHANGE: `agents/surveyor.md` § 1. Stack as built: list each hosted resource the build will use
and every other writer to it, including migrations applied outside the repository.

SEVERITY: low

## B3-24. client-portal: Nothing compared a built screen with its drawing (CRITICAL)

Found in build 2 (client-portal v2, a brownfield build), 2026-10-26, by Joel on the live site.

**What happened.** The Designer drew every screen in Figma at 2 widths, including a 240-wide left
sidebar shell for staff and another for clients. The Engineer built every route, rule and string to
the contract. QA ran 3 times and went green; Security passed; production was rebuilt and promoted.
The live staff page showed v1's top bar instead of the sidebar, with the last menu item pushed off
the end. Joel found it in the first minute of looking. The contract even assumed the sidebar ("the
company switcher, in the sidebar's header"), and every test passed anyway, because a test checks that
the switcher works, not where it sits.

**Why it is systemic.** The same shape as entry 1, for appearance instead of wiring: every stage
verified its own half. The Designer's output was frames; the Engineer's was behaviour; QA's tests
came from the contract, which describes behaviour. No stage held "this screen looks like its frame"
as a check, so no stage could fail it. In a brownfield build it is worse: the survey's shell is
existing code, the contract named screens but never the shell, so nothing told any stage to rebuild
the thing every screen sits inside.

**The change.**

| File | Change |
|---|---|
| `agents/surveyor.md` §4 | Shells listed as surfaces; every screen and shell screenshotted as built at 1440 and 390 |
| `agents/architect.md` | A mandatory screen binding table, shells included; in brownfield, a redrawn surface is `changing`, never `existing` |
| `agents/designer.md` | A mandatory frame index: every surface, state and width to its frame; in brownfield, each marked `matches`, `differs` or `not compared` against the survey's screenshot |
| `agents/engineer.md` | Guardrail 3a: build each row to its frame and screenshot it beside the frame before hand-back; definition of done item 2 |
| `agents/qa.md` | Coverage item 5: a structural fidelity check of every frame-index row, both images saved, the count of rows reported; a difference is a GAP |
| `skills/figma-pull.md` | Frame screenshots, and their cost against the call budget |
