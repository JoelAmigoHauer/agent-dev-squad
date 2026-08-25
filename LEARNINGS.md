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

# Blueprint revisions — learnings from build 2

Derived from `thelma`, the second end-to-end run (2026-08-24). A class C build: a supervised
agentic portfolio manager for RIAs, halted at Stage 6 on an environment blocker.

**Sequencing note.** Stage 7 normally runs after deploy. This build halted at Stage 6, and Joel
directed that the retro run anyway rather than lose the learnings — a deliberate deviation, not a
drift. Entries below draw on every record except `deploy-record.md`'s post-deploy half, which does
not exist yet.

Numbering continues from build 1. Ranked by cost of leaving it alone.

---

## 13. Preflight probes build tooling and never runtime credentials — CRITICAL

**What happened.** Preflight passed with 0 blocking findings. Stages 1 through 5a all completed
green: contract validated, 113 test assertions passing, security review passed with 0 blocking
findings, production build compiling and booting. Stage 6 then could not deploy at all, because
`SUPABASE_SERVICE_ROLE_KEY` cannot be obtained in this environment. The same missing credential
also blocked every end-to-end test, so the build reached "verified" on paper while its whole
write path had never once executed.

**Why it is systemic.** Learning 2 added Preflight to catch missing *tools* — things a stage
shells out to. It probes `node`, `docker`, `semgrep`, MCP connectivity, plan tiers. Every one of
those is a **build-time** dependency. A service-role key, an API key, a signing secret and a
webhook secret are **runtime** dependencies: absent, they break nothing until the moment the
application tries to serve a request, which is after every gate has passed. Preflight's table has
no row shape that can express "the app will need this secret at runtime and this environment
cannot supply it". Every build with a server-side secret hits this, and always at Stage 6, which
is the most expensive place to find it.

**The change.** `agents/preflight.md` gains a third probe section, **Runtime credentials**, run
after the stack is known:

```
| Credential | Needed by | Obtainable here? | If not, what breaks |
|---|---|---|---|
| SUPABASE_SERVICE_ROLE_KEY | ledger writes, agent runtime, seed | NO | every write path, and sign-in |
```

A runtime credential that cannot be obtained is **BLOCKING at Stage 0.5**, not at Stage 6 — the
whole point of Preflight is that the halt is cheap. `agents/architect.md` §1 gains a matching
mandatory field: every contract lists the runtime secrets its design requires, so Preflight has
something to probe against rather than guessing.

**SEVERITY: critical.**

---

## 14. A contract field can be filled with a mechanism that cannot work — HIGH

**What happened.** Contract §1's "First user" field was filled, as build 1's learning 5 requires:
*"a migration reads `FIRST_PRINCIPAL_EMAIL` from the environment, creates the firms row and an
auth.users row with no password"*. It passed the Stage 1 validation pass. It is impossible — a SQL
migration cannot read process environment variables, and inserting directly into `auth.users`
produces an account that cannot complete a password reset. The Engineer hit it at Stage 3 and
raised the build's only `CLARIFICATION`; it became amendment A4.

**Why it is systemic.** Learning 5 made the field **mandatory**, which was right, and the
validation pass checks the field is **present**, which is not the same as checking it is
**possible**. Any mandatory field can be satisfied by plausible-sounding prose. This is the same
failure as learning 1 one level up: there, a flow was described rather than bound; here, a
mechanism is named rather than shown to work.

**The change.** `agents/architect.md`, "First user": the field must name the **artefact** that
implements it — a file path — not a description of one. `supabase/migrations/*.sql`,
`scripts/*.mjs`, an invite flow route. The validation pass adds one check: *can the named artefact
type do what the mechanism claims?* A SQL migration reading process env fails that check in one
line.

**SEVERITY: high.**

---

## 15. Nothing checks the contract against itself — HIGH

**What happened.** Contract §2 specified `decision_ledger.firm_id … on delete cascade` and, forty
lines later in the same section, `create trigger trg_ledger_append_only before update or delete on
decision_ledger`. Both were implemented exactly as written. They are mutually incompatible: a
cascade from `firms` issues a DELETE the trigger refuses, so deleting a firm fails with a trigger
error rather than a foreign-key violation. QA found it **in teardown**, by luck of having written
a teardown, not by design. It became amendment A5.

**Why it is systemic.** Every consistency check in the pipeline is *between* artefacts — flow
bindings reconcile §1 against §3, QA reconciles the build against the contract. Nothing reconciles
the contract against itself. §2 is the section most exposed to this, because it contains three
sub-languages that constrain the same rows — DDL, triggers and RLS policies — written in separate
blocks by the same agent in one pass. A cascade that a trigger blocks, a policy that a constraint
forbids, and a default that a check rejects are all the same defect shape, and all invisible to
every stage that reads only its own half.

**The change.** `agents/architect.md` §2 gains a **self-consistency pass**, the schema analogue of
the flow-bindings reconciliation that learning 1 added:

> For every table carrying a trigger or an RLS policy, state what each foreign key does on delete
> and confirm no trigger or policy refuses that action. A cascade into an append-only table is the
> canonical failure.

Cheap, mechanical, and it catches the whole class rather than this instance.

**SEVERITY: high.**

---

## 16. Preflight records a tool's plan tier, not whether this machine can use it — HIGH

**What happened.** Preflight probed 21st.dev, recorded `tier: paid, unmetered`, and passed it —
correctly, on its own terms. Stage 2 then found that every `installCommand` the catalogue returns
embeds `$API_KEY_21ST`, and that variable is not set in this environment. The CLI install route
was dead. Components had to be retrieved through the MCP tool and vendored by hand instead, which
means Engineer guardrail 3 ("use the 21st.dev component named in design.md") was satisfied only
partially — recorded as such in `build-notes.md` rather than claimed as complete.

**Why it is systemic.** This is learning 2 recurring **with Preflight already in place**, which is
what makes it worth an entry rather than a bug report. Preflight asks two questions — *does the
tool answer?* and *what tier?* — and both were answered correctly. It never asks the third: *can
this machine actually invoke it?* Tier and reachability are different facts, and the gap between
them is invisible until a stage tries to use the tool. `gitleaks` is the same shape: installed
nowhere, reachable through neither the release route nor the container route.

**The change.** `agents/preflight.md`'s probe table gains an **Invocable?** column distinct from
Status and Tier, and the 21st.dev row specifically gains "check `API_KEY_21ST` is set, not only
that `get_usage` answers". A tool that answers but cannot be invoked is `DEGRADED`, with the stage
that carries it named — which is the machinery Preflight already has, simply never pointed at this
question.

**SEVERITY: high.**

---

## 17. The 5a/5b split assumes 5a runs against a local stack — MEDIUM

**What happened.** Learning 3 split Security into 5a pre-deploy (local) and 5b post-deploy
(hosted), because Supabase advisors are hosted-only and could not run at 5a. On this build Docker
was absent, so there was no local stack at all and every stage worked against the hosted project
from Stage 3 onward. Advisors therefore ran **at 5a**, found 14 warnings, and had them fixed
before deploy was even attempted — the outcome learning 3 wanted, reached by ignoring the
mechanism it prescribed.

**Why it is systemic.** The split encodes *where* a check runs (local vs hosted) as a proxy for
*when* it can run (pre vs post deploy). Those come apart whenever a build has a hosted project
before deploy, which is every build without a working local stack — and, on this machine, that is
every build. Applied mechanically, the rule would have deferred advisors to 5b and shipped with a
layer unchecked, which is precisely what learning 3 exists to prevent.

**The change.** `agents/security.md` reframes the split by **capability, not by stage**: run every
check as soon as its target exists. If a hosted project exists at 5a, advisors run at 5a. 5b
becomes "everything that could not run earlier, plus everything that only becomes true once real
data and real users exist" — the seeded first user, the deployed client bundle, the live env vars
— rather than "the hosted checks".

**SEVERITY: medium.**

---

## 18. A degraded tool has no stated substitute, so each stage invents one — MEDIUM

**What happened.** Preflight correctly marked `gitleaks` DEGRADED and named Stage 5a as carrying
the loss. Stage 5a then had to invent the substitute itself: `semgrep p/secrets` over the tree,
plus explicit greps for assigned credential literals, JWT-shaped strings and `sb_secret_` values,
plus a check that `.env.local` is untracked. Those cover the working tree and **not git history**,
which is the half that matters most for a leaked key — and that limit was reasoned out at 5a
rather than known in advance.

**Why it is systemic.** The DEGRADED mechanism records *which stage inherits a loss* but nothing
about *what the fallback is or what it fails to cover*. So the substitute is improvised under time
pressure by whichever stage hits it, and its blind spots are discovered by whoever thinks hardest
in the moment rather than being written down once. Preflight already distinguishes DEGRADED from
BLOCKING on the basis that "a stated fallback exists" — but nowhere is the fallback actually
stated.

**The change.** `agents/preflight.md`: DEGRADED requires three things, not one — the stage that
carries it, **the named substitute**, and **what the substitute does not cover**. `agents/security.md`
gains a per-tool fallback row so the substitute is doctrine rather than improvisation:

```
| Tool | If unavailable, substitute | Substitute does NOT cover |
|---|---|---|
| gitleaks | semgrep p/secrets + literal greps over the tree | git HISTORY — a key committed then removed |
```

**SEVERITY: medium.**

---

## 19. A pinned test-tool version and a pre-installed browser build are two different facts — MEDIUM

**What happened.** Preflight recorded Playwright as OK: browsers pre-installed at
`/opt/pw-browsers`, `@playwright/test` resolvable. At Stage 4, every browser test failed and every
API test passed. The cause was a version mismatch — `@playwright/test` 1.62.1 expects Chromium
build 1234, the container ships 1194 — and the tool's own advice, `npx playwright install`, is
forbidden in this environment and cannot succeed. It cost a fix-loop iteration, correctly logged
`cause: environment` so it did not consume the cap.

**Why it is systemic.** The symptom is indistinguishable from a broken application: seven page
tests red, an assertion-shaped error message, a trace file. Under learning 4's cap-by-cause rule
it was survivable; under a naive cap it would have burned an iteration and pointed the Engineer at
code that was fine. Any pre-provisioned browser will drift from any pinned test package eventually,
so this recurs on a clock rather than by chance.

**The change.** `agents/preflight.md`'s Playwright row must compare the **pinned package version**
against the **installed browser build**, not merely confirm both exist. `/ERRORS.md` now carries
the diagnostic signal that identifies it in one glance, which is the durable half of the fix:
**API tests passing while every page test fails means the browser never launched.**

**SEVERITY: medium.**

---

## 20. The contract does not say which mechanism wins when two govern the same field — LOW

**What happened.** The mandate governs cash twice over: `min_cash_bps` and `liquidity_need` in §2,
and separately the allocation bands that guardrail rule 3 enforces. The contract states both and
never states which governs. The Engineer inferred that an asset class absent from the mandate's
bands is unauthorised — correct for every class except cash — so every household holding cash was
reported in breach. QA caught it as GAP 1.

**Why it is systemic.** The loop worked, so the bug itself is not the lesson. The lesson is what
made it available: whenever a contract constrains one quantity through two mechanisms, the
precedence between them is a real decision, and prose that mentions both without ranking them
reads complete. This is a domain-modelling gap that will recur on any class B or C build with
overlapping constraints, and it is cheapest to settle at Stage 1.

**The change.** `agents/architect.md` §2: where a field is governed by more than one mechanism,
state which binds and what the other one is for. One line — *"cash is governed by `min_cash_bps`,
not by allocation bands; a mandate need not band cash"* — would have removed the inference
entirely.

**SEVERITY: low.**
