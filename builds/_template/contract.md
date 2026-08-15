# Contract — <app-name>

Written by: Architect, Stage 1. Binding on Stages 2–6.
Date: <YYYY-MM-DD>

All five sections are mandatory. Amendments are appended at the bottom, dated, by the Architect
only.

---

## 1. Written spec

```
FIDELITY: prototype | production
```

Sets the Designer's mode and the Engineer's tolerance for rough edges. When the intake does not
say, this is `production`.

### Screens

<one entry per screen, named>

### User flows

<start to finish, including failure paths>

### Core entities

<and how they relate>

### Auth requirements

<who can sign in, what they can see, what they can change>

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
