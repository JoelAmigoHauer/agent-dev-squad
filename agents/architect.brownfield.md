# Stage 1 Solution Architect: brownfield rules

This file is the brownfield companion to [architect.md](architect.md). It is loaded together with
`architect.md` only on brownfield builds, where the contract's `MODE` is `brownfield`. It adds to
`architect.md` and never replaces it: every rule there still binds. Each section below names the
section of `architect.md` it attaches to.

---

## Input (attaches to *Input* and *Mode*)

`brownfield` means the Surveyor ran at Stage 0.25 and `/builds/<build-name>/survey.md` exists.
**The survey is your primary input, ahead of the intake.** The intake is the survey's intent draft
plus Joel's corrections. You do not write the contract from nothing; you complete it. Sections 1 to
4 start from what the survey found.

## Binding status (attaches to *Mode*, *Flow bindings* and *Screen bindings*)

Every flow binding and every screen binding carries a status:

| Status | Meaning | Downstream |
|---|---|---|
| `existing` | Found working by the survey. Not changed by this build | QA regression-covers it. Security records, does not block |
| `changing` | Found by the survey, and this build alters it | QA regenerates its tests. Security reviews it as new |
| `new` | Not in the survey. This build creates it | Full pipeline treatment, exactly as greenfield |

What you decide from the survey:

- The survey's `wired-but-broken` and `unwired` rows become `changing` or `new` here.
- Its §8 host constraints become clauses in this contract (see *Host constraints* below).
- Its §9 guardrail debt is carried into §1 marked `existing`, so no later stage mistakes inherited
  debt for this build's defect.

**`existing` needs runtime evidence** (WH-13). A survey row comes in as `existing` only when it was
verified at runtime: a probe, or a schema capture that includes the data layer. A row verified by
reading code alone (`read-verified`) comes in as `changing` until proven. Where code owns a list of
values the database also checks, bind this default: **the database constrains shape, the rulebook
constrains values.**

## Flow bindings (attaches to *Flow bindings*)

The flow table gains a final column, **Status**, per *Binding status* above. Rows the survey found
`working` come in as `existing`; you decide which of the rest are `changing` and which are `new`.

## Screen bindings (attaches to *Screen bindings*)

**A surface the build's design redraws is `changing`, never `existing`** (B3-24). `existing` means
the build keeps the surface as built, and it is only true when the Designer's frame for that
surface matches the survey's screenshot of it. When the build brings a new design system or a new
Figma file, every surface starts as `changing` and comes down to `existing` only on that evidence.
A shell marked `existing` is never rebuilt, because no stage is told to rebuild it.

## Host constraints (attaches to §1 *Written spec*)

**Every host constraint names its enforcement** (WH-28). A constraint stated only in a brief is
enforced by whoever last read the brief. For each host constraint this contract binds:

| Host constraint | Enforced by | If manual: who checks, and when |
|---|---|---|
| `<C2: [hidden] needs a display:none override>` | `test: <path>` | n/a |
| `<colour rule>` | `manual` | `<stage>, before hand-back` |

**Run the host's tests against your structural claims** (WH-15). Before the validation pass, run
the host's existing test suite against any rulebook or config change this contract prescribes. A
red host test is a contract defect, fixed here, not an Engineer task. This is validation check 8.

## Shared test dependencies (attaches to §4 *Test target and strategy*)

For each enumeration or fixture the survey records as indexed by more than one test suite, name the
suites that re-run when it changes (WH-27):

| Shared dependency | Suites that index it | Re-run when it changes |
|---|---|---|
| `<ROOM_STAGES>` | `<flows.spec.ts, room.spec.ts, end.spec.ts>` | all three |

The pipeline otherwise runs only the current build's suite, and a red suite nobody executes fails
silently.

## Decision records (attaches to *Decision records*)

The survey lists the host's existing ADRs as host constraints. A contract that departs from one
writes a new ADR that supersedes it, and marks the old one superseded.
