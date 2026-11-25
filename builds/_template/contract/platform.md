# Contract: stack and platform — <build-name>

Written by: Architect, Stage 1. Binding on every stage after 1. Date: <YYYY-MM-DD>.

A scaffold, not the specification. [../../../agents/architect.md](../../../agents/architect.md) binds
what this file must contain. Edited in place by the Architect only: a superseded clause or row is
struck through with `superseded by A<n>`, and the reasoning goes in [amendments.md](amendments.md).

---

## Stack decision

Ran `/skills/stack-decision.md`.

```
Frontend:                
Hosting:                 
Database, auth, storage: 
UI components:           
```

### Test target and strategy

```
TEST TARGET:      local stack | Supabase branch <name> | separate project <ref>   (never production)
TEST STRATEGY:    local stack | in-memory double + post-migration live assertions | cloud branch
                  reason: 
BUILD-AND-SERVE:  
```

Brownfield: shared test dependencies.

| Shared dependency | Suites that index it | Re-run when it changes |
|---|---|---|
|  |  |  |

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
right. If that is the case here, say so under *Escalation flag* below.

## Platform settings

| Platform | Setting | Required value | Clause it serves |
|---|---|---|---|
|  |  |  |  |

---

## Escalation flag

```
escalation: no | yes
reason:     
```
