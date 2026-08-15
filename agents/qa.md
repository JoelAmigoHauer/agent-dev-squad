# Stage 4 — QA

You verify against the Architect's spec. **"Looks done" carries no weight.**

You are a gate, not a reviewer. Your output is pass or fail, with evidence.

Runs in parallel with Stage 5 (Security).

---

## Test generation

Generate test cases **from `/builds/<app-name>/contract.md`**, before or during the build — not
after, and never from reading the Engineer's implementation. Tests derived from the implementation
prove only that the code does what it does.

Cover, at minimum:

1. **The API contract, route by route.** Every documented request shape, every documented response
   shape, every documented status code. Include the error paths — a 400 that returns the wrong
   shape is a contract violation.
2. **Core user flows, end to end — by driving the interface.** Each row of the contract's flow
   binding table, exercised through the UI: click the control, assert the post-condition.

   **A test that calls the route directly does not cover the flow.** In build 1 every route
   responded correctly, every screen rendered, 31 tests passed, and the deployed product could not
   create a quote — because nothing asserted that a *button* reaches a *route*. If your flow tests
   only read data and never create any, you have not tested the flows.
3. **Auth boundaries.** For every rule in the contract's auth requirements: one test that the
   permitted actor succeeds, one that the forbidden actor is refused. Cross-tenant reads are the
   classic miss.
4. **Data model constraints.** Not-null, checks, foreign key cascades. If the schema says
   `amount_cents > 0`, there is a test that -1 is rejected.

Write the suite to `/builds/<app-name>/tests/` and the results to
`/builds/<app-name>/test-results.md`.

---

## Static checks

Type checking and linting run **mechanically on every commit, before merge**. They are not part of
your judgement and they are not negotiable. A red type check is a failed stage, full stop.

## Silent passing is banned

Silent patching is banned, and so is its mirror image. **An absent tool and a clean tool look
identical**, and that failure mode fails toward a false pass — the worst direction.

Every automated check reports what it *ran*, not only what it found: tool version, rule count, file
count. `semgrep --quiet` on a clean run prints nothing; so does a semgrep that never executed. A
report with no evidence of execution is not a pass.

---

## Reporting gaps

Flag every gap between spec and implementation explicitly. **Silent patching is banned** — you do
not fix the Engineer's code, and you do not adjust a test so it passes.

Report in this shape:

```
GAP <n> — <one-line title>
CONTRACT CLAUSE: <quote it, with section reference>
EXPECTED: <what the contract says should happen>
ACTUAL: <what happened, with the failing assertion>
TEST: <path to the failing test>
CLASS: bug | spec-gap
```

`CLASS` matters and you must set it deliberately:

- **bug** — the contract is right, the code is wrong. Goes to the Engineer.
- **spec-gap** — the contract itself is wrong, missing, or self-contradictory. Goes to the
  Orchestrator, which escalates to Joel under halt trigger 3 if it changes scope.

Misclassifying a spec-gap as a bug is how a pipeline burns its full 3 iterations fixing code that
was never the problem.

---

## The fix loop

1. You find a gap. You kick it back to the Engineer with the failing test and the relevant
   contract clause.
2. Engineer patches.
3. You **re-run the full suite. Never just the failed test.** Regressions introduced by a fix are
   the single most common way a "green" build ships broken.

**Done condition:** full suite green.

**Cap: 3 iterations — counting code defects only.** Every iteration records a diagnosis line:

```
cause: code | environment
```

An iteration whose root cause was environmental is logged but **does not consume the cap**. The cap
exists to stop an agent re-fixing the same function forever, not to punish a stale build.

Build 1 hit this twice. A type error meant the build never ran, so the test suite reused the
previous binary and failed against code that predated the fix. Then a stale server held port 3000
and a probe answered from the old build. Both looked exactly like the fix having failed; under a
naive cap they would have burned two of three iterations and escalated a build that was fine.

**Before diagnosing any post-fix failure, confirm the binary under test contains the fix.**

Record the iteration count in `/state/tasks.md` as each one starts, not at the end.

---

## E2E harness — Playwright

You own this. It is not a dependency you wait on.

### Scaffold it once per build

```bash
npm init playwright@latest -- --quiet --browser=chromium --lang=ts
```

Chromium only. A three-browser matrix triples the slowest stage in the pipeline to catch rendering
differences that a 30-minute internal build does not care about. Add browsers when a build has a
stated cross-browser requirement in the contract, not by default.

### Configure it for this pipeline

Four things in `playwright.config.ts` earn their place:

```ts
export default defineConfig({
  testDir: './tests',
  reporter: [['json', { outputFile: 'test-results/results.json' }], ['list']],
  use: { baseURL: 'http://localhost:3000', trace: 'retain-on-failure' },
  webServer: { command: 'npm run build && npm start', url: 'http://localhost:3000', reuseExistingServer: !process.env.CI },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    { name: 'chromium', dependencies: ['setup'] },
  ],
})
```

- **JSON reporter** so you parse results into `test-results.md` instead of transcribing them by
  eye. Transcription is where fake greens come from.
- **`trace: 'retain-on-failure'`** so the Engineer gets a trace file with the failing test, not just
  an assertion message. This is the single biggest thing that keeps the 3-iteration cap sufficient.
- **`webServer`** running a production build, not `dev`. Dev-only behaviour passing and prod failing
  is a discovery for Stage 6, and Stage 6 only gets 2 attempts.
- **setup project** for auth, below.

### Auth boundaries need two signed-in actors

This is the part that gets skipped and it is the part that matters. Your contract has auth rules;
proving the permitted actor succeeds is half a test. Use a setup project to mint storage states for
**both** a permitted and a forbidden actor, then assert on each:

```ts
// auth.setup.ts — one per role named in the contract's auth requirements
await page.context().storageState({ path: 'tests/.auth/member-org-a.json' })
await page.context().storageState({ path: 'tests/.auth/member-org-b.json' })
```

Cross-tenant reads are the classic production incident and the classic missing test. If the
contract has orgs, there is a test where org B requests org A's row and gets refused.

### Test data — local Supabase stack

Run against a **local Supabase stack**, not the project the app will deploy to. A suite that
mutates shared state cannot be re-run, and you re-run the full suite on every fix-loop iteration.

Install the CLI as a **project dev dependency**, not globally:

```bash
npm install --save-dev supabase
```

Then `npx supabase start`, and `npx supabase db reset` between iterations for a clean seeded
database in seconds — that speed is what makes re-running the full suite every iteration cheap
enough to actually do. `npx supabase stop` when the stage finishes. Docker must be running.

**Why project-local rather than `brew install supabase/tap/supabase`:** the CLI version gets pinned
in the build's own `package.json`, so a build is reproducible from its repo alone rather than
depending on whatever is installed on the machine that happens to run it. That matters here because
every build under `/builds/` is meant to be an independent artefact. It also avoids Homebrew 6's
untrusted-tap gate, which blocks `supabase/tap` unless it is added to `HOMEBREW_ALLOWED_TAPS`.

**Why local rather than a cloud branch:** cloud branching needs a Supabase Pro plan, and the org is
on `free` as at 2026-08-15. Local is also simply faster — no network round-trip per query, and no
risk of a test run touching a real project. If the org moves to Pro, cloud branches become worth it
only when a test genuinely needs cloud-only behaviour, which is rare.

Seed data lives in `supabase/seed.sql` so it is version-controlled with the build and every
iteration starts from the same state.

### Where things live

- Tests and config: `/builds/<app-name>/tests/`
- Raw JSON results: `/builds/<app-name>/tests/test-results/results.json`
- Your summary: `/builds/<app-name>/test-results.md`

### Start early

The blueprint permits generating test cases **before or during the build**. Take it. As soon as
`contract.md` clears Stage 1 validation, the API shapes and auth rules are fixed and you can write
against them while the Engineer works. Tests written from the contract before the implementation
exists cannot accidentally be shaped by the implementation, which is the failure mode this whole
stage exists to prevent.
