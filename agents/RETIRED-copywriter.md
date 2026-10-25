# Stage 2a — Copywriter: RETIRED

**Retired 20 September 2026 by Joel. Do not recreate it. Do not write a
replacement role that does the same job under another name.**

Copy is now written and fixed by **`/anthropic-skills:full-rewrite`**, Joel's
own router over seven single-purpose rewrite passes. A stage that needs words
invokes that skill. It does not invoke a squad agent.

## Why it went

The role produced usable decks. It also produced, or failed to catch, three
separate invented-number findings in one build:

| Found by | What |
|---|---|
| Publisher check, after the deck shipped | `81%` "report no meaningful bottom-line gains", traceable to no McKinsey publication |
| A later stage | six fabricated benchmark scores rendered in the scorecard PDF under "based on MethodWorks' client experience" |
| Stage 6 | 12 unsourced figures, including the `60%` that carried a page's entire opening argument in its hero, `<title>` and og card |

The role's own definition carried a gate for exactly this: "every number
traces to a source file. A price you remember is a price you invented." The
gate was written, stated as run, and did not catch them. A gate an agent marks
itself against is not a gate.

The second reason is simpler. Joel has a working voice system already. The
squad was carrying a parallel one that had to be handed the canon each time,
could not see the canon when the session ended, and cited a file that lives in
session uploads rather than the repo. Two systems, one of them worse, both
claiming authority over the same words.

## What replaces it

**`/anthropic-skills:full-rewrite`.** It reads the content, names the single
biggest weakness in one line, and applies the matching pass:

`lived-in-voice` · `make-it-credible` · `sharper-point-of-view` ·
`strip-ai-tells` · `show-the-thinking` · `one-friend-flow` · `top-editor-pass`

Where a specific weakness is already known, the pass is invoked directly by
name instead of through the router.

## What a stage does now

1. Write the copy in the stage that owns the surface. The Engineer writes the
   page's words with the rest of the page
2. Run `/anthropic-skills:full-rewrite` over it before the stage hands back
3. **Every figure is checked against the primary source, by the Orchestrator,
   not by the stage that wrote it.** The publisher, the offer ladder, the
   positioning brief. Not the IP Bible, which carries known defects, and not
   memory
4. A figure with no primary source does not ship. It is removed and recorded,
   never rounded to something plausible

Rule 3 is the one that matters. All three invented-number findings in this
build were caught by someone other than the agent that used the number.

## The record stays

Everything under `builds/website/` that names the Copywriter is a record of
what happened and is correct as written. None of it is rewritten. The nine
copy decks it produced stay as the source of the shipped wording.
