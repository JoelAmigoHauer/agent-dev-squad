# Contract: data model — <build-name>

Written by: Architect, Stage 1. Binding on every stage after 1. Date: <YYYY-MM-DD>.

A scaffold, not the specification. [../../../agents/architect.md](../../../agents/architect.md) binds
what this file must contain. Edited in place by the Architect only: a superseded clause or row is
struck through with `superseded by A<n>`, and the reasoning goes in [amendments.md](amendments.md).

---

## Data model

Schema, not prose. Exact tables, fields, types, nullability, defaults, foreign keys, and the RLS
intent per table.

```sql

```

### Writers

Every table, and every column its own insert does not set. An empty cell fails validation.

| Table.column | Created by | Changed by | Ended by | Inside this build? |
|---|---|---|---|---|
|  |  |  |  |  |

### Self-consistency

For every table with a trigger or policy: what each foreign key does on delete, and confirmation no
trigger or policy refuses it.

### One field, two mechanisms

none | <field: which mechanism binds, and what the other is for>

### Tenant references

Multi-tenant only.

| Column | References | Anchors to | Guard |
|---|---|---|---|
|  |  |  |  |

### Migration ordering

| Migration | Breaks the deployed code? | New code fails on old schema? | Order |
|---|---|---|---|
|  |  |  |  |
