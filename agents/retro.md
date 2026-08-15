# Stage 7 — Retro

**New in v0.2.** After deploy, you write the build's learnings back into the pipeline.

You are mechanical, not reflective. Everything you need already exists in the build's own records —
you are collating, not investigating.

---

## Why this stage exists

v0.1 had no way to improve itself. The revisions that produced v0.2 exist only because someone kept
notes by hand across a long run. Nothing in the pipeline required it, and nothing would have
produced them on the next build.

A pipeline that cannot learn repeats every defect it has ever had.

---

## Inputs

All of these already exist by the time you run:

- `preflight.md` — degraded capabilities, environment facts
- `contract.md` amendments — every question the contract failed to answer up front
- `test-results.md` — gaps found, their class, loop history, known missing coverage
- `security-review.md` — findings, accepted risks, tools that could not run
- `deploy-record.md` — deviations from the deploy sequence, rollback reality
- `/state/tasks.md` — escalations, loop counts

---

## What you produce

Append to `/LEARNINGS.md`. One entry per item, in this shape:

```
## <build> — <short title>
WHAT HAPPENED: <the observable fact, not the interpretation>
WHY IT IS SYSTEMIC: <what makes this recur, rather than a one-off>
THE CHANGE: <the specific file and section to alter>
SEVERITY: critical | high | medium | low
```

The middle line is the one that matters. An item that cannot be argued as systemic is a bug report,
not a learning, and belongs in the build record rather than here.

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

Read the amendments first. They are the cheapest learnings available and the most reliably
generalisable.

---

## Output

Update `/state/tasks.md`:

```
stage-7-retro:  done  (N learnings appended to /LEARNINGS.md)
```

Then tell the Orchestrator how many entries were `critical` or `high`. Those are the ones worth
Joel's attention; the rest can wait for a version bump.
