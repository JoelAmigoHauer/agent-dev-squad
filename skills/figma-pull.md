# Skill — Figma pull

**Loads when:** the Designer (Stage 2) or the Engineer (Stage 3) names this file, and `design.md`
records a Figma source. By path, never on keyword match.
**Does not load:** when there is no Figma file. Sketch-derived values are a legitimate outcome, not
a degraded one — see the entitlement section.

**Purpose:** extract exact values from Figma instead of estimating them, so the Engineer works from
real data rather than from the Designer's approximation of the sketch.

---

## Status as at 2026-08-15 — no Figma MCP connected

**This routine currently has no tooling behind it.** A connection probe on 2026-08-15 found no
Figma Dev Mode MCP server in the session. The MCP server the blueprint's tooling map records as
Figma exposes Weave (weavy.ai) workflow tools instead — a different product entirely.

Until a Figma Dev Mode MCP is connected, every build is sketch-derived. That is a legitimate
outcome, not a failure: mark tokens as `derived` in `design.md`, and the Engineer treats derived
values as adjustable rather than binding. Do not stall a build waiting for this.

The rest of this file is the routine to follow once the connection exists. The entitlement check
below still applies at that point.

---

## Precondition — check entitlement first

Figma Dev Mode MCP requires a **Dev or Full seat on a paid Figma plan**. Free tier and View/Collab
seats are locked out, or capped at **6 calls per month**.

Check this before you plan a multi-call extraction. The cap is small enough that a careless
exploratory pass consumes the whole month.

**If entitlement fails:** stop. Do not retry, do not burn calls probing. Note the failure in your
stage output, proceed with sketch-derived values marked as *derived, not extracted*, and let the
Orchestrator raise it with Joel as an operational issue. It is not a build blocker.

---

## Call budget

Plan the extraction before you make the first call. On a capped seat, one build gets one pass.

Batch what you need into the fewest calls:

1. One pass for **tokens** — colour, spacing, type scale, radius, shadows.
2. One pass for **component structure** on the screens in the contract.
3. One pass for **asset exports** — icons, images, logos.

Three calls, not thirty. Exploring the file node by node is what exhausts the cap.

---

## What to extract

### Tokens (always)

- Colour variables with their names, not just hex values. Names carry semantic intent that hex does
  not.
- Spacing scale as actual numbers.
- Type: family, size, weight, line-height, letter-spacing per style.
- Radius and shadow values.

### Structure (per screen in the contract)

- Layout: auto-layout direction, gap, padding, alignment.
- Component instances and their variant properties.
- Constraints and resizing behaviour, which is where responsive intent lives.

### Assets

- Export icons and images at the resolutions the build needs.
- Record where each asset lands in the repo.

---

## What not to do

- **Do not eyeball a value that exists as data.** That is the entire point of this routine. If the
  spacing is 14, do not ship 16 because it looked close.
- **Do not extract screens the contract does not name.** Scope creep by extraction is still scope
  creep, and it costs calls.
- **Do not treat Figma as authoritative over the contract.** If a Figma screen shows a field the
  data model does not have, that is a clarification request to the Architect, not a schema change.

---

## Output

Record in the invoking stage's output file (`design.md` for Stage 2, `build-notes.md` for Stage 3):

```
FIGMA SOURCE: <file url or key>
SEAT/ENTITLEMENT: ok | failed — <reason>
CALLS USED: <n>
TOKENS: extracted | derived from sketch
SCREENS EXTRACTED: <list>
ASSETS: <list, with repo paths>
UNRESOLVED: <anything the file did not answer>
```

Marking values as `extracted` versus `derived` matters downstream: the Engineer treats extracted
values as binding and derived values as adjustable.
