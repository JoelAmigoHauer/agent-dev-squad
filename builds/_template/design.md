# Design — <app-name>

Written by: Designer, Stage 2.

---

## Mode

`A — fast pass` | `B — production pass`

Why: <one line>

---

## Screen inventory

One entry per screen from the contract, named by its path. A number is a label local to this file.

### `/<path>`
- Layout:
- Components:
- States: empty / loading / error / success
- Reached by: <the navigation control, matching the contract's Reached from; never only from an
  error state>

---

## Component provenance

Mode B only.

| Component | Source | Identifier / reason |
|---|---|---|
|  | 21st.dev | |
|  | hand-built | <why the search returned nothing usable> |

---

## Design tokens

| Token | Value | Source |
|---|---|---|
| colour |  | extracted (Figma) / derived (sketch) |
| spacing |  | |
| type scale |  | |
| radius |  | |

---

## Figma

```
FIGMA SOURCE: 
SEAT/ENTITLEMENT: ok | failed — <reason> | n/a
CALLS USED: 
TOKENS: extracted | derived from sketch
SCREENS EXTRACTED: 
ASSETS: 
UNRESOLVED: 
```

---

## Frame index

**Mandatory, v0.3.** One row per surface in the contract's screen binding table, per state, per
width. Shells first.

| Surface | State | Width | Frame | As built (brownfield) |
|---|---|---|---|---|
| `<role>` shell | default | wide | `<node id>` | `matches` / `differs`: <what> / `not compared` |

---

## Raised to the Architect

<any screen needing a field the contract does not have — as a clarification request, never a quiet
addition>
