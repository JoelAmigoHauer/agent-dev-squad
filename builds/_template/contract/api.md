# Contract: API contract — <build-name>

Written by: Architect, Stage 1. Binding on every stage after 1. Date: <YYYY-MM-DD>.

A scaffold, not the specification. [../../../agents/architect.md](../../../agents/architect.md) binds
what this file must contain. Edited in place by the Architect only: a superseded clause or row is
struck through with `superseded by A<n>`, and the reasoning goes in [amendments.md](amendments.md).

---

## API contract

Exact routes, request and response shapes, status codes. The common error shape is stated once,
here; route sketches name only what is specific to them.

```
errors, every route:  { error: string; field?: string }
order:                401 → 400 → 403 → 404 → 500 (no detail for an untranslated database error)
update and delete:    zero rows affected is 404
```

```

```
