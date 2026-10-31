# Test results — <app-name>

Written by: QA, Stage 4. Tests generated from `contract.md`, never from the implementation.

---

## Verdict

```
SUITE: green | red
ITERATION: <n>/3
E2E (Playwright): passed | failed | NOT RUN — a suite that skipped this layer is not green
TRACES ON FAILURE: <paths, for the Engineer>
TEST TARGET: <from contract §4, never production> — strategy: <from contract §4>
RESET BETWEEN ITERATIONS: yes | no
BLOCKED FLOWS: none | <flow rows skipped for a missing credential; each blocks Stage 6>
```

---

## Static checks

| Check | Result |
|---|---|
| Type check (app) | |
| Type check (spec tree) | |
| Lint | |
| Writers diff against the contract's writers table | |

Red on either is a failed stage. Not negotiable.

---

## Coverage

| Area | Cases | Result | Cited by (spec file:assertion) |
|---|---|---|---|
| API contract, route by route (incl. error paths, exact key sets) | | | |
| Core user flows, end to end, from Reached from (incl. failure paths) | | | |
| Auth boundaries (permitted succeeds / forbidden refused) | | | |
| Data model constraints (not-null, checks, FK cascades) | | | |
| Visual fidelity, frame-index rows checked | | | |

A claim with no citation is a plan, and is written as one. Every new or regenerated test was shown
red against its defect before it counts here.

---

## Gaps

```
GAP <n> — <one-line title>
CONTRACT CLAUSE: <quote it, with section reference>
EXPECTED: 
OBSERVED: <with the failing assertion, and how and when it was obtained>
DEDUCED: none | <inference, and from what>
TEST: <path>
CLASS: bug | spec-gap
```

`bug` → Engineer. `spec-gap` → Orchestrator, and to Joel if it changes scope.
Write each gap here as you find it, not at the end of the pass.

---

## Loop history

| Iteration | Gaps found | Cause (`code` / `environment` / `test-defect`) | Full suite re-run | Result |
|---|---|---|---|---|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | still red after this fix: cap, halt and escalate |

Only `code` consumes the cap. A pass with no code change is not an iteration.

Re-run the **full** suite every iteration. Never just the failed test.
