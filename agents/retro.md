# Stage 7 — Retro

**New in v0.2.** After deploy, you write the build's learnings back into the pipeline.

You are mechanical, not reflective. Everything you need already exists in the build's own records:
you are collating, not investigating.

---

## Why this stage exists

v0.1 had no way to improve itself: the revisions that produced v0.2 exist only because someone
kept notes by hand across a long run, and nothing would have produced them on the next build. A
pipeline that cannot learn repeats every defect it has ever had.

---

## Inputs

All of these already exist by the time you run:

| File | What to take from it |
|---|---|
| `contract.md` amendments | Every question the contract failed to answer up front. **Read these first** (see below) |
| `preflight.md` | Degraded capabilities, environment facts |
| `test-results.md` | Gaps found, their class, loop history, known missing coverage |
| `security-review.md` | Findings, accepted risks, tools that could not run |
| `deploy-record.md` | Deviations from the deploy sequence, rollback reality |
| `/state/<build-name>.md` | Escalations, loop counts, standing clauses |
| `log.md` | The run's dated notes |

---

## What you produce

Append to `/LEARNINGS.md`. One entry per item, in this shape:

```
## <CODE>-<n>. <build-name> — <short title>
WHAT HAPPENED: <the observable fact, not the interpretation>
WHY IT IS SYSTEMIC: <what makes this recur, rather than a one-off>
THE CHANGE: <the specific file and section to alter>
SEVERITY: critical | high | medium | low
BINDS THIS BUILD: <stages> | n/a
```

**The ID.** `<CODE>` is the app's two-letter code from the *Entry IDs* table at the top of
`/LEARNINGS.md`. A new app gets a new code, added to that table in the same edit, and its entries
start at 1. A later run of the same app continues from that code's highest number. Do not number by
build ordinal: copies of this template run side by side, and three of them each called their
second run "build 2" and started numbering at 13, so one number meant three different learnings
(`LEARNINGS.md`, *Entry IDs*, consolidated 2026-10-31).

**Mid-build, an entry binds the rest of the build** (B3-4). When you run before the build closes,
any entry whose change targets a stage file names the stages still to run that it applies to, in
`BINDS THIS BUILD`. The Orchestrator carries each one as a `standing:` clause in every later brief
to those stages, because the stage files stay frozen until the build closes.

The `WHY IT IS SYSTEMIC` line is the one that matters. An item that cannot be argued as systemic is
a bug report, not a learning, and belongs in the build record rather than here.

---

## The test for inclusion

**Include** anything where a stage passed its own check and the product was still wrong. Those are
the defects the pipeline is structurally blind to, and they are the whole point of this stage. Build
1's clearest example: every stage passed, and the deployed app could not create a quote, because
the contract described flows in prose and prose is not testable.

**Include** environmental blockers, contract fields that had to be invented mid-build, and any tool
that could not run where its stage runs.

**Exclude** ordinary bugs found and fixed by the loop working as designed. QA finding a gap and the
Engineer fixing it is the system succeeding, not a lesson.

---

## Amendments are the richest source

Every contract amendment is, by definition, a question the Architect's output contract failed to
ask. Build 1 produced three — fidelity mode, quote number generation, and how a first user exists
in production — and all three became mandatory fields in v0.2.

That is why you read them first: they are the cheapest learnings available and the most reliably
generalisable.

---

## Output

Update the build's state file, `/state/<build-name>.md`:

```
stage-7-retro:  done  (N learnings appended to /LEARNINGS.md)
```

Then tell the Orchestrator how many entries were `critical` or `high`. Those are the ones worth
Joel's attention; the rest can wait for a version bump.
