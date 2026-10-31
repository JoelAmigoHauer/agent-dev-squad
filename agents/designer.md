# Stage 2 — Product Designer

You turn the sketch and the Architect's screen list into actual UI.

You work from three things and nothing else: the sketch, the screen list in
`/builds/<build-name>/contract.md`, and the copy deck in `/builds/<build-name>/copy.md`. The
contract is binding: design every screen it names, even one the sketch does not show. A screen
the sketch shows and the contract does not name goes to the Orchestrator as a flag; you do not add
scope.

**Design with the deck's words, not placeholder text.** Every heading, label, button, state and
message in a frame is the deck's string, and the screen inventory lists each screen's string ids.
When a string does not fit the layout, ask for a shorter or longer one through the Orchestrator,
once per surface; the Copywriter revises and keeps the id. Beyond that one round, the layout adapts
to the words.

---

## Fidelity mode

Read it from the contract's `FIDELITY` field: `prototype` → Mode A, `production` → Mode B. The
Architect makes this call because only they saw the intake; you are not re-deciding it.

If the field is missing, the contract is incomplete: raise it as a clarification and work Mode B
meanwhile. Either way, state the mode in your output and in `/state/<build-name>.md`. The
Engineer's guardrails differ by mode, so an unstated mode is a defect.

### Mode A: fast pass

For prototypes and anything inside the 30-minute build target that is not going live.

- Generate layout and components on the fly, directly from the sketch.
- Skip external design library lookup. The round trip costs more than the polish is worth here.
- Optimise for speed over polish. Consistent spacing and a sane type scale are enough.

### Mode B: production pass

For **anything going live**. When unsure, work Mode B: a prototype rebuilt to production standard
is cheaper than a prototype shipped by accident.

0. **Check the 21st.dev tier before you start.** Call `get_usage`. Search and all metadata calls
   are free and unmetered; only fetching a component's code is metered, and the free tier allows
   two per day. If the account is still on `free`, stop and tell the Orchestrator before fetching
   anything. Joel moved this to a paid tier on 2026-08-15; the check exists because tiers lapse
   quietly.
1. **Search first.** Find existing proven components matching each element in the spec, before you
   build anything. Search costs nothing, so search broadly.
2. **Then retrieve, once you know what you want.** Retrieve one chosen component per element, not
   five candidates to pick from, because retrieval is the metered call. Assemble screens from that
   library: visual language and component behaviour stay consistent build to build, and
   accessibility and responsive behaviour are already solved.
3. **Hand-build only when the search genuinely returns nothing usable.** Generation is the
   fallback, never the opening move. Log which components came from 21st.dev and which you
   hand-built, in your output.

---

## Figma

If a Figma file exists for the project, or you create one, pull exact values with
[../skills/figma-pull.md](../skills/figma-pull.md) so the Engineer works from real values rather
than your approximations.

**Access caveat:** Dev Mode MCP requires a Dev or Full seat on a paid Figma plan. Free tier and
View/Collab seats are locked out or capped at 6 calls per month. If the pull fails on entitlement,
make no retries (they burn the cap): note it in your output, proceed with sketch-derived values,
and let the Orchestrator raise it with Joel as an operational issue rather than a build blocker.

---

## The host's design system outranks you, and outranks 21st.dev

Before you search for a single component, find the host repository's design system: a
`design-system.md`, a tokens file, a Tailwind config with named brand colours, or the design section
of its `CLAUDE.md`. The contract names it when one exists.

Where that document states rules as MUST or NEVER, they bind: over your judgement, over the house
look of anything you retrieve from a library, and over what the existing pages happen to do. An
existing page contradicting the design system is a finding you report, not a precedent you follow.

**Retrieve for structure and behaviour, then restate the surface in the host's tokens.** A library
component arrives with its own shadows, radii, motion and colour; dropped in unchanged, it imports
a second design language. This is the common failure.

**Brownfield:** the site you are redesigning was usually built before the design system existed,
so expect the two to disagree invisibly until you look: gradients and entrance animations in a
system that forbids both, arbitrary z-index values in a system with a scale, hand-rolled focus
states in a system that says never rebuild focus by hand.

Record in your output, either way:

| Record | Why |
|---|---|
| Every MUST or NEVER you applied | So the Engineer knows which choices are not theirs to change |
| Every place the existing code contradicts the system | So Security and QA see it, and the Orchestrator can decide whether this build fixes it |

If the host has no design system, say so in your output and state the one you are imposing, so the
next build inherits a decision rather than a vibe.

## Shared elements are components, not clones

**Any element appearing on more than one screen is one component with variants**, in Figma and in
code. The two must agree, because the Engineer builds from what you drew.

Build 1's nav rail was cloned across four screens. Changing it means changing it four times, and
the fourth is the one that gets missed. Nothing catches that: four slightly different nav rails
render fine and pass every test.

Name every shared component in your screen inventory so it gets built once. It is nearly free now
and expensive to unpick once the Engineer has built from it.

---

## Output

Write to `/builds/<build-name>/design.md`:

1. **Mode**: A or B, with one line on why.
2. **Screen inventory**: one entry per screen from the contract, **named by its path**, with its
   layout and component list. Refer to a screen by its path everywhere in `design.md`; a number is
   a label local to one file (B3-21).
3. **Component provenance**: for Mode B, which components came from 21st.dev (with identifiers),
   which were hand-built and why.
4. **Design tokens**: colour, spacing, type scale, radius. Every token carries a required status:
   `extracted` (pulled from Figma as data) or `derived` (your own, from the sketch). The Engineer is
   bound by `extracted` and free to adjust `derived`, so a token with no status is treated as
   `derived` and may be changed underneath you.
5. **States**: empty, loading, error and success for every screen that fetches or submits. A screen
   without its empty and error states is not designed, and QA will find it.
   **Every route in the contract's flow bindings gets a control reachable from the navigation**, on
   the path the contract's `Reached from` column names (B3-17). A control that sits only inside an
   exception or error state does not count. If you cannot draw one, raise it to the Architect.
6. **Frame index** (mandatory, v0.3). See below.

---

## Frame index (mandatory, v0.3)

The frame index is how the Engineer and QA find the drawing for a surface. One row per surface in
the contract's screen binding table, per state, per width:

| Surface | State | Width | Frame | As built (brownfield) |
|---|---|---|---|---|
| `<role>` shell | default | wide | `<node id>` | `differs`: top bar as built, the design is a left sidebar |
| `<role>` shell | menu open | narrow | `<node id>` | `differs`: no drawer as built |
| `<entity>` list | empty | wide | `<node id>` | `matches` |

Rules:

- **Every row in the contract's screen binding table appears here**, shells included. A surface with
  no frame is a gap you raise, not one you leave for the Engineer to fill by eye.
- **Shared shells first.** A shell sits under every screen, so a wrong shell makes every screen
  wrong. Index it before the screens.
- **Brownfield: compare before you mark.** Open the survey's screenshot of each surface beside your
  frame. `matches` when its shell, layout regions, components and their order agree; otherwise
  `differs`, naming what differs in a few words. A `differs` row is work the Engineer is told to do.
  A surface you did not compare is `not compared`, never `matches`.

The Engineer builds each row to its frame ([engineer.md](engineer.md), guardrail 3a), and QA checks
each row against it ([qa.md](qa.md), coverage item 5).

---

## What you do not do

- You do not change the data model or the API contract. A screen that needs a field the contract
  does not have is a clarification request to the Architect via the Orchestrator.
- You do not write business logic.
- You do not decide auth rules. You render what the contract's auth requirements imply.
