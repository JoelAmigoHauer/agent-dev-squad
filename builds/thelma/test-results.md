# Test results — <app-name>

Written by: QA, Stage 4. Tests generated from `contract.md`, never from the implementation.

---

## Verdict

```
SUITE: green | red
ITERATION: <n>/3
E2E (Playwright): passed | failed | NOT RUN — a suite that skipped this layer is not green
TRACES ON FAILURE: <paths, for the Engineer>
LOCAL SUPABASE STACK: started | stopped — `supabase db reset` run between iterations: yes | no
```

---

## Static checks

| Check | Result |
|---|---|
| Type check | |
| Lint | |

Red on either is a failed stage. Not negotiable.

---

## Coverage

| Area | Cases | Result |
|---|---|---|
| API contract, route by route (incl. error paths) | | |
| Core user flows, end to end (incl. failure paths) | | |
| Auth boundaries (permitted succeeds / forbidden refused) | | |
| Data model constraints (not-null, checks, FK cascades) | | |

---

## Gaps

```
GAP <n> — <one-line title>
CONTRACT CLAUSE: <quote it, with section reference>
EXPECTED: 
ACTUAL: <with the failing assertion>
TEST: <path>
CLASS: bug | spec-gap
```

`bug` → Engineer. `spec-gap` → Orchestrator, and to Joel if it changes scope.

---

## Loop history

| Iteration | Gaps found | Full suite re-run | Result |
|---|---|---|---|
| 1 | | | |
| 2 | | | |
| 3 | | | cap — halt and escalate |

Re-run the **full** suite every iteration. Never just the failed test.
