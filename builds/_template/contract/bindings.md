# Contract: flow and screen bindings — <build-name>

Written by: Architect, Stage 1. Binding on every stage after 1. Date: <YYYY-MM-DD>.

A scaffold, not the specification. [../../../agents/architect.md](../../../agents/architect.md) binds
what this file must contain. Edited in place by the Architect only: a superseded clause or row is
struck through with `superseded by A<n>`, and the reasoning goes in [amendments.md](amendments.md).

Every row reconciles with a screen in [spec.md](spec.md) and a route in [api.md](api.md).

---

## Flow bindings

**Mandatory.** Prose is not testable — a flow written as a sentence gets verified as a sentence.
Every flow that crosses the UI/API boundary gets a row, because a row is a thing QA can drive.

| Flow | Screen | Reached from | Control | Calls | Post-condition |
|---|---|---|---|---|---|
| Create `<entity>` | `/<entities>` | nav "`<Entities>`", signed in | "New `<entity>`" | `POST /api/<entities>` | lands on `/<entities>/:id` |
| Add child to `<entity>` | `/<entities>/:id` | a row in `/<entities>`, `<entity>` open | "Add `<child>`" | `POST /api/<entities>/:id/<children>` | child appears, derived totals change |
| Change state | `/<entities>/:id` | a row in `/<entities>`, state `<from>` | "`<verb>`" | `PATCH /api/<entities>/:id` | badge changes, prior state refused |

**Reached from** is the navigation path and the state in which the control is live. QA starts
there, never from a typed URL.

Placeholders on purpose. Substitute this build's own nouns and delete any row that does not apply —
a worked example in one domain gets pattern-matched into the next build's thinking.

Every row here must reconcile with a screen in the list above and a route in [api.md](api.md). A control that
calls nothing, or a route no control reaches, is the defect this table exists to catch.

## Screen bindings

**Mandatory, v0.3.** Every screen and every shared shell (navigation, header, page frame, drawer)
gets a row. The Designer adds each row's frame ids in `design.md`'s frame index, and QA checks every
row against its frames.

| Surface | Kind | Routes | Widths | Status |
|---|---|---|---|---|
| `<role>` shell | shell | every `/<role>/*` route | wide, narrow | `new` |
| `<entity>` list | screen | `/<entities>` | wide, narrow | `new` |

Status is brownfield only. A surface the build's design redraws is `changing`, never `existing`:
`existing` needs the Designer's frame to match the survey's screenshot.
