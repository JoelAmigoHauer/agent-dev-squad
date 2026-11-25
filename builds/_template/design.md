# Design — <build-name>

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
- Strings: <copy deck ids used on this screen>
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

## Motion

Limits L1 to L9 in [../../agents/designer.md](../../agents/designer.md) *Motion* bind every value
here. The Engineer ships it verbatim; QA measures the build against it.

```
MOTION: <build-name>, <YYYY-MM-DD>
HOST MOTION RULES: <path and the MUST or NEVER lines applied> | none found
PATTERNS: P1 <on | off (reason)>   P2 <on | off (reason)>   P3 <on | off (reason)>
```

### Tokens

| Token | Value | Status |
|---|---|---|
| `--motion-fast` | 150ms | derived / extracted |
| `--motion-base` | 200ms | |
| `--motion-slow` | 250ms | |
| `--ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | |
| `--ease-out` | `cubic-bezier(0, 0, 0.2, 1)` | |
| `--ease-in` | `cubic-bezier(0.4, 0, 1, 1)` | |
| `--float-sm` | 4px | |
| `--float-md` | 8px | |
| `--spinner-delay` | 300ms | |
| `--spinner-min` | 500ms | |
| `--spinner-turn` | 800ms | |

### Components (P1, and P2 where it submits)

One row per interactive component in the screen inventory above.

| Component | Hover | Press | Focus-visible | Submits (P2) |
|---|---|---|---|---|
| `<component>` | state layer 8%, `--motion-fast` | state layer 12% | instant ring | yes / no |

### Loading states (P2)

One row per `loading` state above, by screen path.

| Screen | Region or control | Size | Accessible name (copy deck id) |
|---|---|---|---|
| `/<path>` | | 16px / 24px | `<path>.loading` |

### Entrances (P3)

One row per element that arrives after first paint, by screen path.

| Screen | Element | Entrance | Exit |
|---|---|---|---|
| `/<path>` | | fade, `--motion-base` | none |

### Reduced motion

Confirmed as in `agents/designer.md`, or the host's stricter rule:

### Existing motion

Brownfield only. Every existing transition or animation, and whether it breaks a limit.

| Where | What | Breaks | This build |
|---|---|---|---|
| | | L<n> / none | fix / leave (Orchestrator's call) |

### Left still

Anything that might have moved and does not, one line each.

---

## Raised to the Architect

<any screen needing a field the contract does not have — as a clarification request, never a quiet
addition. A missing loading string goes to the Copywriter; a host motion rule that breaks a limit
goes to the Orchestrator>
