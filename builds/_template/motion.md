# Motion spec: <build-name>

Written by: Motion, Stage 2.5. How the interface moves: tone shifts on hover, press and focus, the
loading indicator, and entrances. The Engineer ships it verbatim; QA measures the build against it.

This template is a scaffold. [../../agents/motion.md](../../agents/motion.md) is the binding copy,
limits L1 to L9 included: validate against it, not against this file.

---

```
MOTION SPEC: <build-name>, <YYYY-MM-DD>
HOST MOTION RULES: <path and the MUST or NEVER lines applied> | none found
PATTERNS: P1 <on | off (reason)>   P2 <on | off (reason)>   P3 <on | off (reason)>
```

---

## Tokens

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

---

## Components (P1, and P2 where it submits)

One row per interactive component in `design.md`'s screen inventory.

| Component | Hover | Press | Focus-visible | Submits (P2) |
|---|---|---|---|---|
| `<component>` | state layer 8%, `--motion-fast` | state layer 12% | instant ring | yes / no |

---

## Loading states (P2)

One row per `loading` state in `design.md`, by screen path.

| Screen | Region or control | Size | Accessible name (copy deck id) |
|---|---|---|---|
| `/<path>` | | 16px / 24px | `<path>.loading` |

---

## Entrances (P3)

One row per element that arrives after first paint, by screen path.

| Screen | Element | Entrance | Exit |
|---|---|---|---|
| `/<path>` | | fade, `--motion-base` | none |

---

## Reduced motion

Confirmed as in the agent file, or the host's stricter rule:

---

## Existing motion

Brownfield only. Every existing transition or animation, and whether it breaks a limit.

| Where | What | Breaks | This build |
|---|---|---|---|
| | | L<n> / none | fix / leave (Orchestrator's call) |

---

## Left still

Anything that might have moved and does not, one line each.

---

## Raised

Clarifications sent to the Copywriter (a missing loading string) or the Designer (a motion that
needs a layout change), and any host rule that conflicts with a limit.
