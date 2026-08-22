# Contract — <app-name>

Written by: Architect, Stage 1. Binding on Stages 2–6.
Date: <YYYY-MM-DD>

All five sections are mandatory. Amendments are appended at the bottom, dated, by the Architect
only.

This template is a scaffold, not the specification of what a contract must contain.
[../../agents/architect.md](../../agents/architect.md) is the binding copy — validate against it,
not against this file.

---

## 1. Written spec

```
FIDELITY:    prototype | production
BUILD CLASS: A | B | C — <the trait that puts it there>
```

**Fidelity** sets the Designer's mode and the Engineer's tolerance for rough edges. When the intake
does not say, this is `production`.

**Build class** sets what "done on time" means for this build. `A` is CRUD plus auth (~30 minutes),
`B` is domain logic with derived values (~2 hours), `C` fires an escalation trigger (no target).
A build landing between two classes takes the higher one.

### Screens

<one entry per screen, named>

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
account with the exact steps.

### Flow bindings

**Mandatory.** Prose is not testable — a flow written as a sentence gets verified as a sentence.
Every flow that crosses the UI/API boundary gets a row, because a row is a thing QA can drive.

| Flow | Screen | Control | Calls | Post-condition |
|---|---|---|---|---|
| Create `<entity>` | `<entity>` list | "New `<entity>`" | `POST /api/<entities>` | lands on `/<entities>/:id` |
| Add child to `<entity>` | `<entity>` detail | "Add `<child>`" | `POST /api/<entities>/:id/<children>` | child appears, derived totals change |
| Change state | `<entity>` detail | "`<verb>`" | `PATCH /api/<entities>/:id` | badge changes, prior state refused |

Placeholders on purpose. Substitute this build's own nouns and delete any row that does not apply —
a worked example in one domain gets pattern-matched into the next build's thinking.

Every row here must reconcile with a screen in the list above and a route in §3. A control that
calls nothing, or a route no control reaches, is the defect this table exists to catch.

---

## 2. Data model

Schema, not prose. Exact tables, fields, types, nullability, defaults, foreign keys, and the RLS
intent per table.

```sql

```

---

## 3. API contract

Exact routes, request and response shapes, status codes, error shape.

```

```

---

## 4. Stack decision

Ran `/skills/stack-decision.md`.

```
Frontend:                
Hosting:                 
Database, auth, storage: 
UI components:           
```

**Deviation from default:** none | <trigger number, the specific spec text that fires it, what the
default stack would fail to do, what is proposed instead and what it costs>

### Plan tiers

**Mandatory.** State the plan and its operative limits for every service above, not just the
product. Plan limits change what later stages can do and are invisible until they bite — a free
tier with no cloud branching invalidated QA's database design in build 1, after it was written.

Copy the probed values from `preflight.md`, which ran at Stage 0.5. Do not restate a tier from
memory or from another build's contract.

```
<service>:  <plan> — <operative limits: quotas, caps, what it cannot do>
<service>:  <plan> — <operative limits>
```

A stack whose plan cannot support this contract's requirements is an escalation trigger in its own
right. If that is the case here, say so in §5.

---

## 5. Escalation flag

```
escalation: no | yes
reason:     
```

---

## Amendments

<!-- 
## <YYYY-MM-DD> — <what changed>
Raised by: <stage>
Clause affected: <section>
Change: <the new binding text>
Downstream impact: <does QA need to regenerate tests? does the schema change?>
-->
