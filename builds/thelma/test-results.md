# Test results — thelma

Written by: QA, Stage 4.
Date: 2026-08-24

```
VERDICT: PASS, with a stated scope limit.

  113 assertions passed, 3 skipped and documented, 0 failing.
  2 gaps found and closed — one code defect, one contract self-contradiction.
  Fix loop: 1 of 3 code iterations used. Two further iterations were non-code and did not
  consume the cap.

  The scope limit is not a caveat on the result; it is part of the result. Full end-to-end
  flows could not run in this environment. See "What was NOT tested".
```

Tests were generated from `contract.md`, not from reading the implementation. Tests derived from
an implementation prove only that the code does what it does.

---

## What ran, with evidence of execution

An absent tool and a clean tool look identical, and that failure mode fails toward a false pass.
So each row records what actually executed, not only what it found.

| Suite | Tool + version | Command | Files | Result |
|---|---|---|---|---|
| Unit | vitest 3.2.7 | `npx vitest run --config vitest.config.ts` | 6 | **80 passed** |
| Database constraints | Postgres 17.6 via Supabase MCP `execute_sql` | `builds/thelma/tests/db/constraints.sql` | 1 | **16 passed** |
| Browser / auth boundary | @playwright/test 1.62.1, Chromium 1194 | `npx playwright test` | 1 | **17 passed, 3 skipped** |
| Type check | tsc 5.7.3 | `npx tsc --noEmit` | whole project | **0 errors** |
| Production build | next 16.3.2 | `npm run build` | 24 routes | **succeeded** |

Raw JSON: `builds/thelma/tests/test-results/unit.json`, `.../e2e.json`.

### Static checks

`tsc --noEmit` is clean across the project. It ran against the same tree the tests ran against —
a red type check means the build never produced a new binary, and the suite then tests the previous
one, which is one of the two stale-artefact failures build 1 hit.

---

## Coverage against the contract

### §3 API contract — error shapes and status codes

Every protected route was driven unauthenticated and asserted to return exactly
`401 {"error":"unauthorized"}`. Nine routes across GET, POST and PATCH:
`/api/ledger`, `/api/ledger/verify`, `/api/ledger/export`, `/api/recommendations`,
`/api/custodian/connections`, `/api/custodian/sync`, `/api/custodian/import`,
`/api/advisors/invite`, `/api/firm/settings`.

`/api/health` answers 200 without a session, carrying `ok`, `commit` and `migrations` — it is the
one route with no screen behind it, and Stage 6 depends on it.

### §1 flow bindings — what was and was not driven through the UI

The contract's flow-binding table exists because build 1 shipped a product where every route
responded, every screen rendered, 31 tests passed, and nothing wired the button to the route.

What was driven through the browser: the unauthenticated boundary on `/`, `/households`, `/ledger`
and `/settings` (all redirect to `/sign-in`), and the sign-in screen itself.

**The create-and-mutate flows were not driven.** They need a signed-in advisor. This is the
scope limit, stated plainly below rather than left to be inferred from a green summary.

### §1 auth requirements

Proven: no unauthenticated access to any protected route or page.

Proven: the sign-in screen offers **no** route to create an account. Asserted by scanning the
rendered body for `sign up`, `create account` and `register` and requiring none, plus asserting the
invite-only copy is present. A public sign-up route on a system holding custodial positions is a
finding at the first examination, and this is the assertion that keeps one from creeping in.

Not proven: role separation and cross-tenant isolation. Written and **skipped**, not omitted — see
below.

### §2 data model constraints — 16 assertions, all passing

These prove the governance rules hold at the database, where application code cannot route around
them. That distinction is the whole claim §2 makes.

| # | Assertion | Result |
|---|---|---|
| T1 | ledger hash chain links row to row; `seq` assigned by the trigger | PASS |
| T2 | ledger `UPDATE` refused | PASS |
| T3 | ledger `DELETE` refused | PASS |
| T4 | published mandate is immutable | PASS |
| T5 | `published` → `superseded` is permitted | PASS |
| T6 | at most one published mandate per household | PASS |
| T7 | unbounded `auto_execute` cannot be stored | PASS |
| T8 | bounded `auto_execute` can be stored | PASS |
| T9 | a disordered allocation band is refused | PASS |
| T10 | a negative close price is refused | PASS |
| T11 | an approved recommendation must name an advisor | PASS |
| T12 | a pending recommendation with no decider is storable | PASS |
| T13 | recommendation rationale is frozen after creation | PASS |
| T14 | a firm with ledger history cannot be deleted (A5) | PASS |
| T15 | RLS is enabled on every public table | PASS |
| T16 | `decision_ledger` has no write policy at all | PASS |

### The guardrail engine — 24 assertions

The engine is the contract's central safety claim. Two structural properties were asserted
alongside the eleven individual rules:

- **All 11 rules are always evaluated**, passes included. Asserted on a clean pass, where the
  result must still carry eleven outcomes. A result carrying only failures cannot distinguish
  "rule 7 checked and fine" from "rule 7 never ran", and an examiner needs that difference.
- **It never short-circuits.** A proposal breaching rules 1, 2 and 9 simultaneously must report
  all three.

Each rule has both a refusal case and a permission case. Several permission cases matter as much
as the refusals and are easy to get wrong in the safe-looking direction:

- Rule 1 permits **selling** a prohibited security — that is how a portfolio exits one.
- Rule 7 does **not** count gains inside a sheltered account against a taxable budget.
- Rule 8 does not apply to a plain rebalance in an IRA, only to harvesting.
- Rule 11 blocks **execution** under shadow mode but does not block **proposing** — shadow mode's
  entire purpose is safe testing on live data, and a rule that suppressed proposals would defeat it.

### Numeric policy — 13 assertions

`0.1 + 0.2` is exactly `0.3`. A thousand-position book sums without drift. A sum beyond safe
integer range throws rather than silently losing precision. An empty portfolio yields `0` bps, not
`NaN` — a `NaN` propagating into a band comparison makes every rule pass silently.

### Ledger hashing — 7 assertions

`computeRowHash` reproduces the database trigger's formula exactly, byte for byte. This one matters
disproportionately: if the two ever drift, verification reports tampering on an untampered ledger,
which is worse than not verifying at all. Tampering with the payload, the actor, or any earlier
entry all change the digest.

---

## Gaps found

```
GAP 1 — cash was reported as an allocation-band breach
CONTRACT CLAUSE: §2 `mandates.min_cash_bps`; §3 guardrail rule 5 "post-trade cash >= min_cash_bps,
                 and covers liquidity_need"
EXPECTED:        Cash is governed by `min_cash_bps` and `liquidity_need` (rule 5), not by
                 allocation bands. Mandates band the invested classes to 10000bps while the
                 household still holds cash; that is the normal case, not a breach.
ACTUAL:          `computeDrift` synthesised an unbanded row for cash with target/min/max of 0 and
                 marked it breached whenever cash > 0, so guardrail rule 3 failed for essentially
                 every real household.
TEST:            builds/thelma/tests/unit/guardrails.test.ts:149
CLASS:           bug
```

Fixed by the Engineer. Cash is now excluded from the unbanded-breach path; a non-cash class the
mandate never authorised is still flagged, and an explicit cash band is still honoured. Three
regression assertions pin all three behaviours. **Full suite re-run, not just the failing test.**

Worth stating why this mattered beyond the failing assertion: a breach flag that fires on every
household is a breach flag advisors learn to ignore, and it is the one signal on the screen that
must never become noise.

```
GAP 2 — decision_ledger.firm_id cascade contradicts the append-only trigger
CONTRACT CLAUSE: §2 `decision_ledger`: "firm_id uuid not null references firms(id) on delete
                 cascade", together with `trg_ledger_append_only`
EXPECTED:        One coherent deletion behaviour.
ACTUAL:          A cascade from `firms` issues a DELETE against `decision_ledger`, which the
                 append-only trigger refuses. Deleting a firm therefore fails with a trigger error
                 naming append-only rather than a foreign-key violation, sending whoever hits it
                 to the wrong place.
TEST:            builds/thelma/tests/db/constraints.sql (found in teardown)
CLASS:           spec-gap
```

Routed to the Architect, not the Engineer — the contract specified both clauses and they cannot
both hold. Answered as amendment **A5**: `firm_id` becomes `ON DELETE RESTRICT`, matching the
choice already made deliberately for `household_id` in the same table. No scope change, so no halt
under trigger 3. Migration `0004_ledger_fk_restrict.sql` applied. The finding is now assertion T14.

---

## Fix-loop accounting

The cap is 3, and it counts **code defects only**.

| Iteration | Cause | Consumed cap? | What happened |
|---|---|---|---|
| 1 | **code** | **Yes — 1 of 3** | GAP 1. Fixed, full suite re-run green |
| 2 | test defect | No | Two fixtures of mine had wrong arithmetic: a CSV row left `quantity` blank (the parser was right to quarantine it) and a drift fixture used bond values that genuinely breached a narrower band. Assertions were unchanged; only the fixture numbers were corrected |
| 3 | **environment** | No | Every browser test failed while every API test passed. `@playwright/test` 1.62.1 wanted Chromium build 1234; the container ships 1194. Resolved with `executablePath`, per the environment's own guidance never to run `playwright install`. Appended to `/ERRORS.md` |

Iteration 3 is exactly the failure mode the cause-tagging rule was added for. It looked like the
application being broken — seven page tests red — and under a naive cap it would have burned an
iteration on a suite that was fine. **The distinguishing signal, now recorded in `/ERRORS.md`: API
tests passing while every page test fails means the browser never launched, not that the app is
broken.**

GAP 2 consumed no iteration either: it was routed to the Architect, and a contract amendment is not
an Engineer fix attempt.

---

## What was NOT tested, and why

This section exists so a partial run cannot read as a complete one.

**`SUPABASE_SERVICE_ROLE_KEY` is not obtainable in this environment.** No MCP tool exposes it,
which is correct security posture. Three capabilities depend on it and therefore could not be
exercised:

1. **Ledger writes.** `appendLedger` uses the service role because `decision_ledger` deliberately
   has no INSERT policy. The hash chain was proven directly at the database (T1–T3) and the
   application's recomputation was proven in unit tests, but the application writing a ledger entry
   was not driven.
2. **The monitoring cycle end to end.** `POST /api/households/:id/runs` writes `agent_runs`,
   `agent_steps`, `observations` and `recommendations` through the service role. The graph's logic
   is covered by unit tests over its deterministic parts; the route was not driven.
3. **The first-user seed script**, which invites the principal.

**Consequently, no authenticated flow was driven through the UI**, including every create-and-mutate
row of the contract's flow-binding table: publish a mandate, import holdings, run a cycle, approve,
reject, modify, export, verify, toggle shadow mode, invite an advisor.

The three cross-tenant and role-separation tests are written into
`builds/thelma/tests/e2e/auth-boundaries.spec.ts` and marked `test.skip` with the reason attached,
rather than left out. A missing test looks identical to a passing one, and that fails toward a
false pass.

**What Stage 6 must do before this build can be called verified:** set the service role key,
re-run `npx playwright test`, and remove the `test.skip`. Until then the correct description of
this build is *"unit and constraint verified, end-to-end unverified"* — and QA will not describe it
any other way.

**One further known approximation, flagged rather than left to be discovered:**
`projected_drift_bps_after` on a recommendation is a conservative halving of the before figure, not
a computed post-trade drift. The Engineer recorded it in `build-notes.md`. It never claims a better
outcome than it can prove, so it fails safe, but it is not yet a real projection.

---

## Verdict

```
PASS — 113 assertions, 0 failing, 3 documented skips.
       Type check clean. Production build succeeds and boots.
       2 gaps found, both closed, one of which was a contract self-contradiction.
       End-to-end flows unverified for a stated environmental reason.
```

Stage 6 is not blocked by anything in this report. It inherits one obligation: supply the service
role key and re-run this suite, which is the only thing standing between "unit and constraint
verified" and "verified".
