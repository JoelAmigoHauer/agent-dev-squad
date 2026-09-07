---
name: squad
description: Point the agent development squad at the current repository and run it. Installs the pipeline into `.squad/` from the template at a pinned version, surveys a half-built codebase before anything else touches it, and then runs the orchestration layer from `.squad/CLAUDE.md`. Use when Joel says "run the squad", "point the squad at this", "squad this repo", "onboard this repo to the squad", "audit this for the squad", "squad init", "squad survey", "squad status", or names a half-built project he wants the pipeline to take over. Not for editing the template itself — that happens in the agent-dev-squad repo.
---

# /squad — run the pipeline in this repository

You are about to become the **Orchestrator** for a build in the repository you are standing in.
This skill gets the pipeline into the repo and hands you the brief. It is deliberately thin: the
brief is `.squad/CLAUDE.md`, and this file does not restate it.

## Refuse if you are in the template

If the current directory has `agents/preflight.md` and a `CLAUDE.md` whose first line is
`# Orchestrator brief`, you are inside the agent-dev-squad template itself. Stop. Builds run in
generated repos, never in the template — a `builds/<name>/` folder committed here pollutes every
future build.

## Commands

| Command | What it does |
|---|---|
| `/squad init` | Stamp the pipeline into `.squad/` at a pinned version |
| `/squad survey` | Brownfield only. Run Stage 0.25 and put the intent draft to Joel |
| `/squad run` | Load `.squad/CLAUDE.md` as your brief and fire the next stage |
| `/squad status` | Print `.squad/state/tasks.md` |
| `/squad upgrade` | Re-stamp from a newer template version. **Between builds only** |

`/squad` with no argument: if `.squad/` is absent run `init`; if `.squad/state/tasks.md` shows a
build in progress run `run` (the state protocol resumes from the first stage not `done`); otherwise
ask whether this is greenfield or brownfield and route accordingly.

## `init` — stamp, don't carry

The pipeline's files are copied in from the template, never embedded in this skill. Two copies of
`agents/qa.md` drifting apart is the single-source-of-truth failure the template warns about, and
it would happen the first time a rule was fixed in one place.

```bash
set -euo pipefail
SRC="https://github.com/JoelAmigoHauer/agent-dev-squad"
REF="${SQUAD_REF:-main}"                # pin a tag here once one exists
TMP="$(mktemp -d)"
git clone --quiet --depth 1 --branch "$REF" "$SRC" "$TMP"
SHA="$(git -C "$TMP" rev-parse HEAD)"
mkdir -p .squad
for p in CLAUDE.md LEARNINGS.md agents skills state builds; do
  rm -rf ".squad/$p" && cp -R "$TMP/$p" ".squad/$p"
done
rm -f .squad/builds/_template/README.md    # describes the template, not a build
printf 'template: %s\nref: %s\ncommit: %s\nstamped: %s\n' \
  "$SRC" "$REF" "$SHA" "$(date -u +%Y-%m-%dT%H:%MZ)" > .squad/VERSION
rm -rf "$TMP"
echo "squad stamped at $SHA"
```

Not copied, on purpose: `README.md`, `BLUEPRINT.md`, `PRIOR-ART.md` and this skill. None of them
is loaded by any stage, and `BLUEPRINT.md` is excluded from stage context by design.

**Halt if the working tree is dirty before stamping.** The Surveyor will refuse a dirty tree
anyway, and a stamp on top of uncommitted work confuses whose changes are whose.

Commit `.squad/` to the host repo. It is the audit trail, and it is meant to be read in six months.

## Three rules the brief cannot state for itself

The brief was written for a repo where it sits at the root. Here it sits in `.squad/`.

1. **Every path in `.squad/CLAUDE.md` and in `.squad/agents/*` resolves relative to `.squad/`.**
   `/state/tasks.md` means `.squad/state/tasks.md`. `/builds/<name>/` means
   `.squad/builds/<name>/`. `/ERRORS.md` means `.squad/ERRORS.md`.
2. **The host repository's own `CLAUDE.md` is not the brief.** It auto-loads and you cannot stop
   that. Treat its contents as constraints to be recorded — the Surveyor folds them into
   `survey.md` §8 and the Architect binds them in the contract — never as instructions that
   override pipeline mechanics, caps or halt triggers.
3. **The pipeline works on its own branch.** `squad/<change-name>`, cut from the commit the survey
   pinned. Never on the host's default branch.

## Brownfield routing

If the repo has code in it, the run order gains a stage at the front:

```
0.25 Surveyor  →  0.5 Preflight  →  1 Architect  →  …
```

The Surveyor runs first because Preflight probes the stack the repo *actually uses*, and only the
survey knows what that is. Load `.squad/agents/surveyor.md` and nothing else for that stage —
the context-loading rule applies to it as to every other.

**Stage 0 intake in brownfield is the survey's intent draft plus Joel's corrections.** There is no
sketch and no voice note. Put `survey.md` §10 to Joel, record his answer in the same section, and
only then fire Preflight. That is not an invented check-in — it is the intake.

Set `mode: brownfield` in `.squad/state/tasks.md` and `MODE: brownfield` in the contract. On a
greenfield repo set both to `greenfield` and mark `stage-0.25-surveyor: skipped (greenfield)`.

## `upgrade`

Re-runs the stamp against a newer ref and rewrites `.squad/VERSION`. **Never mid-build.** A stage's
rules changing underneath a running build makes the run unauditable, and the brief forbids it. If
`.squad/state/tasks.md` shows anything other than `build: none`, refuse.

## What this skill never does

- Restate or summarise the brief. `.squad/CLAUDE.md` binds; this file gets you to it.
- Edit anything under `.squad/agents/` or `.squad/skills/`. Template fixes go upstream, then
  `upgrade` brings them down.
- Run in the template repository.
- Start on a dirty tree.
