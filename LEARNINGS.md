# Blueprint revisions — learnings, cumulative

What each build proved needs changing. `BLUEPRINT.md` stays unedited as the source record; this file
is the evidence behind every rule that has moved since.

Each entry states what actually happened, why it is systemic rather than a one-off, and the specific
change. Within a build, entries are ranked by cost of leaving it alone.

## Entry IDs

Every entry carries an ID of the form `<build code>-<n>`, where the build code names the app, not
the build's position in a sequence. Build ordinals collided: three copies of this template each
called their second run "build 2" and each numbered its first new entry 13, so the same number
meant three different learnings. An app name cannot collide that way. Build 1's entries keep their
bare numbers 1–12; nothing else is unprefixed.

| Code | App | Runs | Mode | Entries | Was numbered | Ported from |
|---|---|---|---|---|---|---|
| none | `print-estimator` | 2026-08-15 | greenfield | 1–12 | 1–12 | build 1, this repo |
| `TH` | `thelma` | 2026-08-24 to 08-25 | greenfield, halted at Stage 6 | TH-13 to TH-20 | 13–20, "build 2" | branch `claude/thelma-portfolio-agent-ba057f`, archived as tag `archive/thelma-2026-08-25` |
| `WH` | `workshop-hub` | 2026-09-07 to 09-09 | brownfield via `/squad` | WH-13 to WH-29 | 13–29, "builds 2, 3, 5, 6" | branch `claude/claude-md-docs-3l7ior` |
| `B2`, `B3` | `client-portal` | 2026-09-11 to 10-26 | brownfield via `/squad` | B2-1 to B2-3, B3-1 to B3-24 | unchanged | branch `claude/screen-fidelity-check` |
| `WS` | `website` | to 2026-09-20 | via `/squad` | WS-1 | unnumbered: the record in `agents/RETIRED-copywriter.md` | that file, removed on 2026-10-31 when the Copywriter was revived |

`TH` and `WH` keep their original numbers after the prefix, so a citation in an old run record
still finds its entry by stripping or adding the prefix. `client-portal` keeps its `B2-` and `B3-`
IDs because stage files already cite `B3-24`; read them as client-portal's first and second
harvests, not as build ordinals.

A bare number in an entry's text (learning 2, entry 5) means build 1's entry. A prefixed number
means that build's.

New entries follow [agents/retro.md](agents/retro.md): a new app gets a new two-letter code, added
to this table, and a later run of the same app continues that code's numbering.

---

# print-estimator: build 1 (2026-08-15), greenfield

The first end-to-end run of the pipeline. Entries 1–12.

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

## What worked in print-estimator and should not be changed

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

# TH: thelma (2026-08-24), greenfield, halted at Stage 6

Derived from `thelma`, the second end-to-end run (2026-08-24), made in this repository on a
branch that also carried the app's code. A class C build: a supervised
agentic portfolio manager for RIAs, halted at Stage 6 on an environment blocker.

**Sequencing note.** Stage 7 normally runs after deploy. This build halted at Stage 6, and Joel
directed that the retro run anyway rather than lose the learnings — a deliberate deviation, not a
drift. Entries below draw on every record except `deploy-record.md`'s post-deploy half, which does
not exist yet.

Numbered 13–20 on its own branch, continuing from build 1, and kept as `TH-13` to `TH-20`.
Ranked by cost of leaving it alone.

---

## TH-13. Preflight probes build tooling and never runtime credentials — CRITICAL

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

## TH-14. A contract field can be filled with a mechanism that cannot work — HIGH

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

## TH-15. Nothing checks the contract against itself — HIGH

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

## TH-16. Preflight records a tool's plan tier, not whether this machine can use it — HIGH

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

## TH-17. The 5a/5b split assumes 5a runs against a local stack — MEDIUM

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

## TH-18. A degraded tool has no stated substitute, so each stage invents one — MEDIUM

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

## TH-19. A pinned test-tool version and a pre-installed browser build are two different facts — MEDIUM

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
against the **installed browser build**, not merely confirm both exist. thelma's `/ERRORS.md` (on the archived tag, not in this template) carried
the diagnostic signal that identifies it in one glance, which is the durable half of the fix:
**API tests passing while every page test fails means the browser never launched.**

**SEVERITY: medium.**

---

## TH-20. The contract does not say which mechanism wins when two govern the same field — LOW

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

---

# WH: workshop-hub (2026-09-07 to 09-09), brownfield via `/squad`

Four runs in the `workshop-hub` repository, whose records live there under
`.squad/builds/`. Inside this section, "build N" counts runs in *that* repository: build 2 is
Phase 2 (WH-13 to WH-19), build 3 is `workshop-hub-end` (WH-20 to WH-24), build 4 left no
entries, build 5 is `workshop-hub-room-runner` (WH-25 to WH-27) and build 6 is
`workshop-hub-ink-actions` (WH-28, WH-29).

Derived from the runs recorded in `builds/workshop-hub/`. Same test for inclusion as above: a stage
passed its own check and the product was still wrong, an environmental blocker, a contract field
invented mid-build, or a tool that could not run where its stage runs. Ordinary bugs the loop caught
are excluded — the Engineer's own smoke test catching the handler's clock-skew defect before QA ran is
the system working, not a lesson.

---

## WH-13. workshop-hub — a binding marked `working` was refused by the database — HIGH

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

## WH-14. workshop-hub — tool availability changed three times during one run — HIGH

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

## WH-15. workshop-hub — the contract asserted a host-shell mechanic the host's own test forbids — MEDIUM

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

## WH-16. workshop-hub — QA's harness section assumes a stack the contract may not have — MEDIUM

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

## WH-17. workshop-hub — deploy verification writes production data and nothing says who deletes it — LOW

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

## WH-18. workshop-hub — the rollback target can be a month old — LOW

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

## WH-19. workshop-hub — the Retro's own file lives in two places — LOW

**What happened.** On a `/squad` run the pipeline is stamped into the host repo's `.squad/`, so this
file is a copy pinned to one template commit. Stage 7 appends here; the template repository, which
the next `/squad` run will stamp from, does not see it unless someone ports it.

**Why it is systemic.** Every brownfield run produces learnings into a copy. Without a return path the
template stops learning exactly when it is used most.

**The change.** `.claude/skills/squad/SKILL.md`: the run ends with a "port learnings" step — the
Retro's new entries are added to the template repository's `LEARNINGS.md` and listed under its
`CLAUDE.md` *Known gaps* until the stage files absorb them. Done by hand for this run.

---

## WH-20. workshop-hub-end — the deploy CLI invents a project when the link is missing — HIGH
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

## WH-21. workshop-hub-end — Preflight records a tool as absent and nobody ever tries to get it — HIGH
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

## WH-22. workshop-hub-end — time-derived state cannot be tested by rewinding one record — MEDIUM
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

## WH-23. workshop-hub-end — `vercel promote` cannot promote a preview built with preview variables — MEDIUM
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

## WH-24. workshop-hub-end — the loop-cause vocabulary has no word for a defective test — LOW
WHAT HAPPENED: QA's first suite run had two failures, both in the tests rather than the build: one
  expected a phase value to be refused that the handler has always lower-cased, and one hit the
  ordering trap in WH-22. Neither was a gap against the contract and neither should consume a
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

**Still open from build 2, second consecutive manual port.** WH-19 (learnings from `/squad` runs
have no return path) is unchanged: this build's entries were again carried to the template by hand.
Two builds is enough evidence that the port step will not happen by itself.

## WH-25. workshop-hub-room-runner — "additive migration" was read as "order does not matter" — HIGH

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

## WH-26. workshop-hub-room-runner — the `[hidden]` guard is a hand-maintained list, so it stops guarding — HIGH

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

## WH-27. workshop-hub-room-runner — a shared enumeration is indexed by suites nobody runs — MEDIUM

**What happened, and what stopped it.** This build removed one entry from `ROOM_STAGES`, the running
order every screen and all three Playwright suites index into. The pipeline runs only the current
build's suite, which is how build 2's suite sat red across two builds (WH-19's neighbour).

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

## WH-28. workshop-hub-ink-actions — a rule with no executable form is a rule that drifts — HIGH

**What broke.** The host's `CLAUDE.md` carried a non-negotiable rule for months: *red, amber and
green are reserved for score encoding*. Every build read it. Every build obeyed it as it understood
it. And the rule was violated in **30 declarations**, including by the two builds that quoted it
most carefully — `workshop-hub-end` put the session lock in amber, and `workshop-hub-room-runner`
put the accent green on the Initiate pill and wrote a contract decision justifying it on a claim
about token separation that was false.

The claim was checkable in one grep. Nobody grepped, because the rule lived only in prose and prose
does not fail.

**Why it is systemic.** A constraint stated in a brief is enforced by whoever last read the brief.
A constraint with a test is enforced by the runner. This repository already knew that — `C2`, the
`[hidden]` rule, has a test — and still got it wrong, because that test iterates a hand-written list
(WH-26) rather than deriving its subjects. Both failures are the same failure at different
depths: **the enforcement was narrower than the rule.**

**The fix.** `agents/architect.md` needs a mandatory field on brownfield builds: for every host
constraint the contract binds, state **how it is enforced** — `test: <path>`, or `manual`, and if
manual, say who checks it and when. A constraint bound in a contract with no executable form is a
constraint the next build will break while citing it.

And `agents/qa.md` needs the corollary: a test written for a *rule* derives its subjects from the
artefact. `tokens.test.js` in this build parses every rule out of the stylesheet and holds each
against an allow-list of the three legitimate instruments; a new violation written next month fails
without anyone updating the test. It was verified by reintroducing the original defect and watching
two assertions fail.

---

## WH-29. workshop-hub-ink-actions — a documented assertion that was never written — MEDIUM

**What happened.** `workshop-hub-end`'s `test-results.md` states: *"C3 / C9 — the closing states'
computed colours contain neither `--red` nor `--accent`."* No such assertion exists in
`flows.end.spec.ts`. It was prose describing an intention.

That sentence is why the lock kept its amber through two subsequent builds: anyone auditing the
colour rule would read the test record, see the check claimed, and move on. **A false claim of
coverage is worse than no coverage**, because it stops the next person looking.

**The fix.** `agents/qa.md`'s output section should require every coverage claim in `test-results.md`
to name the spec file and the assertion that makes it. A claim without a citation is a plan, and
should be written as one.

---

## What worked in workshop-hub Phase 2 and should not be changed

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

## What worked in workshop-hub-end and should not be changed

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

## What worked in workshop-hub-room-runner and should not be changed

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

---

# B2: client-portal, first harvest (2026-09-11), brownfield via `/squad`

client-portal's first end-to-end run.
Deployed to `methodworks-portal.vercel.app`. One high-severity latent bug
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

# B3: client-portal, second harvest (2026-09-28), and v2 (2026-10-26)

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

Found in client-portal v2 (a brownfield build), 2026-10-26, by Joel on the live site.

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

---

# WS: website (to 2026-09-20), via `/squad`

The build that retired the first Copywriter. Its record lives in that host repo under
`builds/website/`; the summary below was the retirement note, `agents/RETIRED-copywriter.md`,
recorded here as an entry when the Copywriter was revived on 2026-10-31.

## WS-1. website — The Copywriter shipped invented figures while marking its own source gate passed

WHAT HAPPENED: One build produced three separate invented-number findings, each caught by someone
other than the agent that used the number. A publisher check after the deck shipped found `81%`
"report no meaningful bottom-line gains", traceable to no McKinsey publication. A later stage found
six fabricated benchmark scores rendered in the scorecard PDF under "based on MethodWorks' client
experience". Stage 6 found 12 unsourced figures, including the `60%` that carried a page's whole
opening argument in its hero, `<title>` and share card. The role's own definition carried the gate
for exactly this, "every number traces to a source file", and the gate was stated as run.

WHY IT IS SYSTEMIC: A gate an agent marks itself against is not a gate. Copy that is asked to be
concrete and credible pulls toward specific numbers, and a model fills that pull from memory when
no source is in hand. The role also ran a second voice system beside Joel's own, handed the canon
each session and unable to see it afterwards.

THE CHANGE: Retired 2026-09-20; revived 2026-10-31 as `agents/copywriter.md`, Stage 1.5. Every
figure carries `[source: …]`, `[bound: …]` or `[NEEDS SOURCE]` where it is written; the
Orchestrator, never the Copywriter, verifies each against its primary source before the Designer
starts; a figure that fails does not ship. The rewrite passes are an embedded copy of Joel's
`full-rewrite`, so there is one voice system, re-synced whenever his skill changes.

SEVERITY: high
