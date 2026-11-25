# Contract: written spec — <build-name>

Written by: Architect, Stage 1. Binding on every stage after 1. Date: <YYYY-MM-DD>.

A scaffold, not the specification. [../../../agents/architect.md](../../../agents/architect.md) binds
what this file must contain. Edited in place by the Architect only: a superseded clause or row is
struck through with `superseded by A<n>`, and the reasoning goes in [amendments.md](amendments.md).

---

## Written spec

```
MODE:        greenfield | brownfield
FIDELITY:    prototype | production
BUILD CLASS: A | B | C — <the trait that puts it there>
```

**Mode** is `brownfield` when a survey exists at `survey.md`. Then this contract is completed from
the survey, not written from nothing, and every row in [bindings.md](bindings.md) carries a status —
`existing | changing | new`. The survey's host constraints (§8) become clauses here; its guardrail
debt (§9) is carried in marked `existing`.

**Fidelity** sets the Designer's mode and the Engineer's tolerance for rough edges. When the intake
does not say, this is `production`.

**Build class** sets what "done on time" means for this build. `A` is CRUD plus auth (~30 minutes),
`B` is domain logic with derived values (~2 hours), `C` fires an escalation trigger (no target).
A build landing between two classes takes the higher one.

### From the intake

From `/builds/<build-name>/intake.md`, each line no wider than its row.

```
FORMAT:              <F9>
SCOPE:               <P4, flow by flow>
OUT OF SCOPE:        <P5>
SUCCESS METRIC:      <P3>
DATA AT LAUNCH:      <E2, real or mocked per entity>
PRIVACY:             <E4>
BROWSERS AND DEVICES: <Q1>
ACCESSIBILITY:       <Q2>
DEADLINE:            <O1, and what is cut first>
```

### Screens

<one entry per screen, named by its path; a number is a label local to one file>

### User flows

<start to finish, including failure paths>

### Core entities

<and how they relate>

### Auth requirements

<who can sign in, what they can see, what they can change>

### First user

<how the first account exists in a **deployed** database>

"Users are seeded" describes local development and leaves production with no way in. Name the
mechanism: a migration that inserts it, an invite flow, a first-run claim, a manually created
account with the exact steps. Name the **artefact** that does it as a file path, and check its type
can do what the mechanism claims: a SQL migration cannot read process environment.

### Runtime secrets

| Variable | Needed by | Obtainable here? (from `preflight.md`) |
|---|---|---|
|  |  |  |

A secret listed here that Preflight did not probe goes back to Preflight before Stage 3.

### Residency

none | <the data store's region **and** the compute region>

### Unverified premises

A clause stating a fact about existing code, a consumer, a credential, a third-party call or a
platform limit cites where it was read (file and line, or URL and date). Anything unread goes here.

| Unverified premise | Owner | How to verify |
|---|---|---|
|  |  |  |

### Host constraints

Brownfield only. Every constraint from the survey's §8 names how it is enforced.

| Host constraint | Enforced by | If manual: who checks, and when |
|---|---|---|
|  | `test: <path>` \| `manual` |  |
