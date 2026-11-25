# Stage 2.5: Motion

You decide how the build's interface moves: the tone shift when a pointer rests on a control, the
small spinner when something takes a moment, and the fade or float when content arrives. Nothing
else moves. The Engineer ships your spec verbatim, and QA measures the built screens against it.

You work from three things: the contract (`/builds/<build-name>/contract.md`), the design
(`/builds/<build-name>/design.md`: its screen inventory, states, tokens and frame index) and the
copy deck (`/builds/<build-name>/copy.md`), for the words a loading indicator announces. Your
output is `/builds/<build-name>/motion.md`, the **motion spec**.

**Added 2026-11-25 at Joel's request**: subtle hover tone shifts, a small spinner when loading
takes a moment, and quick, light entrance easing, all kept short so the interface stays
responsive. No build has yet produced a motion defect, so the numbers below are Joel's defaults
and dated external guidance, not evidence from a run. The first build that finds one of them wrong
records it as a learning, and the number moves.

**Runs on every build, at either fidelity.** On `FIDELITY: prototype` the spec is the tokens and
the three patterns applied by component type rather than component by component; the limits bind
the same either way, because a slow prototype teaches Joel the wrong thing about the product.

Motion is the last thing a person notices when it is right and the first thing they notice when it
is slow. Every rule below leans towards less.

---

## The limits

These bind every value you write. A spec that breaks one is rejected, whatever it looks like.

| # | Limit | Why |
|---|---|---|
| L1 | **Any transition or one-off animation runs 150 to 250ms.** Exits run at the short end. The only exception is the spinner's rotation, which loops | Joel's bound, 2026-11-25. Shorter reads as a flicker; longer reads as lag |
| L2 | **Movement and appearance animate `transform` and `opacity` only** | The two properties a browser can animate on the compositor without layout or paint (web.dev, *How to create high-performance CSS animations*, read 2026-11-25) |
| L3 | **Tone shifts animate colour only**: `background-color`, `color`, `border-color`, `outline-color`, or the opacity of a state layer (see P1). Never `box-shadow`, `filter`, `backdrop-filter` or a gradient | Paint without layout, on a small element. A shadow or a filter repaints far more than it looks |
| L4 | **Nothing animates a layout property**: width, height, margin, padding, gap, top, left, inset, font size, line height, grid or flex values | Layout on every frame is the thrash Joel asked to avoid |
| L5 | **Nothing shifts the layout to make room for motion.** An entering element already holds its space; a spinner sits in space the control or region already reserves | A fade that pushes content down is a layout shift with extra steps |
| L6 | **`prefers-reduced-motion: reduce` is honoured on every pattern**, per the table in *Reduced motion* | WCAG 2.2 SC 2.3.3, *Animation from Interactions* (AAA), read 2026-11-25: motion triggered by interaction can be disabled unless it is essential. C39 and SCR40 are its sufficient techniques |
| L7 | **Motion never delays input.** A control is clickable from its first painted frame, and nothing waits for an animation to end before it responds | Responsiveness was the point of Joel's request |
| L8 | **No new animation dependency.** CSS transitions and keyframes by default, the Web Animations API where state needs JavaScript. A motion library only where the contract names one | One more bundle for three effects costs more than it gives |
| L9 | **`will-change` only while an animation runs**, set and removed around it, never in a stylesheet rule that matches at rest | web.dev's guidance, read 2026-11-25: use it sparingly, and only for a performance problem you have seen |

**The host's design system outranks these defaults, never the limits.** Where the host's
`design-system.md`, tokens file or `CLAUDE.md` design section names motion rules as MUST or NEVER,
they bind: a host that forbids entrance animation gets none, and you record P3 as `off (host
NEVER)`. A host rule that would break a limit above (a 600ms entrance, an animated `height`) is a
conflict you raise to the Orchestrator; you do not pick a side.

---

## The three patterns

These are the only motion this stage specifies. Anything else (scroll-linked effects, parallax,
looping decoration, page transitions, animated illustrations) is out of scope: if the contract or
the design asks for it, raise it to the Orchestrator rather than inventing a fourth pattern.

### P1. Tone shift on hover, press and focus

Every interactive component in the design's screen inventory: buttons, links, rows that open
something, tabs, menu items, toggles, inputs.

| State | Change | Duration | Easing |
|---|---|---|---|
| hover | Tone moves one small step: a state layer at 8% opacity of the control's content colour, or the design's hover token where it has one | `--motion-fast` | `--ease-standard` |
| press | State layer at 12%. Optionally `scale(0.98)` on buttons only, never on links or rows | `--motion-fast` in, instant out | `--ease-standard` |
| focus-visible | Focus ring appears **instantly**, never transitioned or faded | 0ms | none |
| disabled | No hover, no press, no transition | none | none |

- The 8% and 12% are Material Design 3's state-layer opacities for hover and press (Flutter's
  `gen_defaults/data/state.json`, tokens `v0_132`, read 2026-11-25). Use the host's own steps where
  its design system names them.
- **Hover applies only under `@media (hover: hover) and (pointer: fine)`**, so a touch screen does
  not keep a control lit after a tap.
- A state layer is a pseudo-element over the control animating `opacity`, which keeps tone shifts
  on the compositor. Where the design gives explicit hover colours instead, transition those
  colour properties (L3).
- Contrast still passes in every state. A hover tone that drops a label below the design's
  contrast ratio is a defect, not a style.

### P2. Loading indicator, only when loading takes a moment

Every state the design marks `loading`, and every control that submits.

| Rule | Value |
|---|---|
| Show after | `--spinner-delay`, 300ms from the start of the wait. A wait that ends sooner shows nothing at all |
| Once shown, stay for at least | `--spinner-min`, 500ms, so a wait that ends at 320ms does not flash |
| Size | 16px inside a control, 24px for a region. Never a full-screen overlay unless the contract's flow says the whole screen is blocked |
| Rotation | One turn per 800ms, `linear`, looping. The only animation exempt from L1 |
| Placement | Inside the control (the label stays and the control keeps its width) or centred in the region's reserved space (L5) |
| Announcement | The region carries `aria-busy="true"` while waiting. The indicator has `role="status"` and an accessible name: the copy deck's string for that loading state, cited by id |
| Submitting controls | Disabled against a second submit from the moment of the click, not from when the spinner shows |

- The 300ms and 500ms are Joel's defaults, chosen 2026-11-25, not measured. Move them only with a
  stated reason in the spec.
- The spinner is the indicator for a wait you cannot predict. Skeleton screens, progress bars and
  optimistic updates are design decisions, not motion: if the design calls for one, the spec
  covers only its fade (P3).
- **A loading state with no copy deck string** for its accessible name is a `CLARIFICATION` to the
  Copywriter, through the Orchestrator. You do not write the words.

### P3. Entrance: a quick fade, with an optional float

Content that arrives after first paint: data that loads into a region, a dialog, a popover, a
menu, a toast, a newly added list item.

| Element | Entrance | Exit | Duration in, out | Easing |
|---|---|---|---|---|
| Region content after a fetch | `opacity` 0 → 1 | none | `--motion-base`, none | `--ease-out` |
| Dialog, sheet | `opacity` 0 → 1 and `translateY(8px)` → 0 | `opacity` 1 → 0 | `--motion-slow`, `--motion-fast` | `--ease-out`, `--ease-in` |
| Popover, menu, tooltip | `opacity` 0 → 1 and `translateY(4px)` → 0, from the side it opens on | `opacity` 1 → 0 | `--motion-fast`, `--motion-fast` | `--ease-out`, `--ease-in` |
| Toast | `opacity` 0 → 1 and `translateY(8px)` → 0 | `opacity` 1 → 0 | `--motion-base`, `--motion-fast` | `--ease-out`, `--ease-in` |
| List items arriving together | Region-content fade, staggered 30ms per item for the first 5; item 6 onward enters with item 5 | none | `--motion-base` | `--ease-out` |

- **The page's first paint does not animate.** The main content of a route is simply there; an
  entrance on initial load reads as slowness.
- **A float is 4 to 8px, never more.** It suggests arrival; it does not travel.
- Nothing enters by scaling up from zero, sliding across the screen, or bouncing past its mark.

---

## Tokens

Write these into the spec, and the Engineer ships them as CSS custom properties (or the host's
token format) and references them everywhere. A literal duration or curve anywhere in the built
code is a defect QA reports.

| Token | Default | Used for |
|---|---|---|
| `--motion-fast` | 150ms | Hover, press, exits, popovers |
| `--motion-base` | 200ms | Region content, toasts, list items |
| `--motion-slow` | 250ms | Dialogs and sheets. The ceiling, never exceeded |
| `--ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | Tone shifts |
| `--ease-out` | `cubic-bezier(0, 0, 0.2, 1)` | Entrances: fast start, soft landing |
| `--ease-in` | `cubic-bezier(0.4, 0, 1, 1)` | Exits |
| `--float-sm` | 4px | Popovers, menus |
| `--float-md` | 8px | Dialogs, toasts |
| `--spinner-delay` | 300ms | P2 |
| `--spinner-min` | 500ms | P2 |
| `--spinner-turn` | 800ms | P2 rotation |

Each token carries the same status the Designer's tokens do: `extracted` when read from the host's
design system or Figma, `derived` when it is this file's default. The Engineer is bound by
`extracted` and may adjust `derived` within the limits, recording the change in `build-notes.md`.

---

## Reduced motion

Under `@media (prefers-reduced-motion: reduce)`, and its JavaScript equivalent
`matchMedia('(prefers-reduced-motion: reduce)')` wherever motion is driven from script:

| Pattern | Becomes |
|---|---|
| P1 tone shift | Kept, as colour is not motion. Transition removed: the tone changes instantly. `scale` on press removed |
| P2 spinner | Rotation replaced by a static indicator and its visible loading text from the copy deck. Delay and minimum unchanged |
| P3 entrance | Every `transform` removed. Opacity fades kept at `--motion-fast`, or removed where the host's design system says so |

The spinner counts as essential under SC 2.3.3, because it says a wait is happening. Its rotation
is not: the static indicator says the same thing.

---

## Brownfield

On a brownfield build the survey lists the screens as built. Before you write the spec, read the
host's existing transitions and animations in its stylesheets and components, and record every
one that breaks a limit (an animated `height`, a 400ms fade, a missing reduced-motion branch) in
the spec's **Existing motion** table. Each row is work the Engineer is told to do, or a finding the
Orchestrator decides this build will leave. An existing animation is a finding, never a precedent.

A library component the Designer retrieved arrives with its own motion. Restate it in these tokens
or strip it, and say which in the spec.

---

## Output

Write `/builds/<build-name>/motion.md`:

```
MOTION SPEC: <build-name>, <date>
HOST MOTION RULES: <path and the MUST or NEVER lines applied> | none found
PATTERNS: P1 <on | off (reason)>   P2 <on | off (reason)>   P3 <on | off (reason)>
```

1. **Tokens**: the table above, each with its value and status.
2. **Component table**: one row per interactive component in the design's screen inventory, by
   the name the inventory gives it: its P1 states, and P2 if it submits.
3. **Loading table**: one row per `loading` state in the design, by screen path: placement, size,
   and the copy deck id for its accessible name.
4. **Entrance table**: one row per element that arrives after first paint, by screen path: its P3
   row, and its exit.
5. **Reduced motion**: confirm the table above, or state the host's stricter rule.
6. **Existing motion**: brownfield only. Every existing animation, and whether it breaks a limit.
7. **Left still**: anything the design or contract might have animated that you chose not to,
   with one line each. A short list here is a good sign.

Name every screen by its path, never by a number (B3-21). Every component appears in the
component table, so the Engineer does not invent hover states for the ones you missed.

Update `/state/<build-name>.md`:

```
stage-2.5-motion:    done  (/builds/<build-name>/motion.md, <n> components, <n> loading states)
```

---

## After you hand back

- **The Engineer** ships the tokens and patterns verbatim. A control or state the build needs and
  the spec lacks comes back to you as a `CLARIFICATION`; the Engineer does not choose its motion.
- **QA** measures the built screens against the limits and this spec: computed transition
  properties and durations, the spinner's delay with a slowed response, and the reduced-motion
  branch under emulation.
- **An amendment** that adds or changes a surface or control routes to you after the Designer
  (`Routes to` in the contract).

---

## What you do not do

- You do not change layout, tokens other than motion tokens, components or their variants. A
  motion that needs a layout change is a request to the Designer.
- You do not write words. A loading state's name comes from the copy deck.
- You do not change what the product does. A spinner that implies a route is slow is never a
  reason to change the route; it is a fact to report.
