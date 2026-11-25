# Agent development squad

The words this pipeline uses for its own parts, one word per idea. **No stage loads this file**: it
is Mode 2 material, for whoever edits the template, so a term means the same thing in every stage
file. An app's own domain terms belong in that build's contract, not here. Format adapted from
mattpocock/skills `domain-modeling`, read 2026-10-31.

## Repositories

**Template**:
This repository: the stage files, skills, scaffolds and learnings that every build is stamped from.
_Avoid_: framework, starter

**Host repo**:
The repository a build runs in and the app lives in, with the template stamped into its `.squad/`.
_Avoid_: generated repo, target repo, build repo

**Stamp**:
A copy of the template, at one pinned commit, in a host repo's `.squad/`, recorded in
`.squad/VERSION`. Also the act of making one (`/squad init`, `/squad upgrade`).
_Avoid_: install, vendor, fork

**Port**:
Carrying a host repo's new learnings back into the template (`/squad port`).
_Avoid_: sync, upstream, backport

**Release**:
A tagged template version (`v0.3`) that `/squad` stamps by default.
_Avoid_: build (a build is a run, never a version)

## Runs

**Build**:
One run of the pipeline, from intake to Stage 7, for one new app or one change to an existing app.
_Avoid_: run, job, project, "build 2" (name a build by its build name, never by its position)

**Build name** (`<build-name>`):
The name every file of one build carries: the app's name on a greenfield build, the change's name
on a brownfield one.
_Avoid_: app name, change name, as path placeholders

**Greenfield**, **Brownfield**:
A build's mode. Greenfield starts from a sketch and a voice note; brownfield starts from a survey
of an existing codebase.
_Avoid_: new build, existing build

**Intake**:
What a build starts from, written down as `intake.md` by the kickoff interview at Stage 0: Joel's
answers, read from the material he brought (a repo's survey, a design, a brief, a sketch and voice
note, or only a topic) and confirmed or given on cards.
_Avoid_: brief (a brief is what a stage is given)

**Kickoff interview**:
Stage 0, run by the Orchestrator in its own context from `skills/kickoff-interview.md`. Reads what
exists, then asks Joel the rest one question per card, with a recommended answer.
_Avoid_: onboarding, discovery, questionnaire

**Guard row**:
A kickoff interview row asked on every build even when the material answers it: scope, out of
scope, not software at all, format, design round, voice, banned words, figure sources.
_Avoid_: required field, mandatory question

**Format**:
What kind of thing the build makes, settled by the kickoff interview's F9 and written to the state
file's `format:` line: `web-app`, `saas`, `game`, `iphone`, `integration` or `not-software`.
_Avoid_: platform, app type, product type

**Brief**:
What the Orchestrator hands a stage when it fires it, as the prompt of the stage's subagent: the
agent file and `_common.md`, the contract files the agent file names, the state file, and any
standing clauses.
_Avoid_: prompt, instructions

**Local thread**:
A thread in a Claude project that runs on Joel's machine rather than in the cloud, so the
repository's hooks and skills load. The only kind of thread a build runs in, one build per thread.
_Avoid_: desktop session, cloud thread (a cloud thread is the kind a build never runs in)

## Stages and loops

**Stage**:
One role's place in the run order, such as Stage 4 (QA). Each has one agent file.
_Avoid_: phase, step, agent (the agent is the role; the stage is its place in the order)

**Pass**:
One complete run of a stage, such as QA's fifth pass.
_Avoid_: round, run, layer

**Layer**:
One of Security's review steps: Layer 1 advisors, Layer 2 scanners, Layer 3 the trace of this
build's changes.
_Avoid_: pass

**Iteration**:
One round trip on a finding or gap: the stage reports it, the Engineer changes code, the stage
re-checks. What a loop cap counts.
_Avoid_: pass, retry, loop

**Attempt**:
One try at a deploy, capped at 2. Also how Security settles a finding by trying it rather than
reading code.
_Avoid_: iteration, for deploys

**Cap**:
The most iterations or attempts a loop may use before it halts. Only `code` causes count.
_Avoid_: limit, budget

**Cause**:
What an iteration's failure came from: `code`, `environment` or `test-defect`.
_Avoid_: reason, category

**Halt**:
The pipeline stopping on one of the listed halt triggers, and the Orchestrator escalating to Joel.
_Avoid_: pause, block (blocking is a Preflight and Security severity, and what a check does to a
tool call)

**Check**:
One of the squad checks in `checks/` (v0.4): code that runs before a tool call and blocks it when
a rule is broken. Named by its id, such as `figure-gate`. A check *blocks a call*; it never halts
the pipeline itself.
_Avoid_: validation (the Architect's validation pass is prose), lint (except `state-lint`'s name),
gate on its own

**Liveness probe**:
Preflight's two commands that the squad checks and the git guard must refuse. A refusal proves the
hooks run in this session; a probe that runs halts the build.
_Avoid_: health check, smoke test (a smoke check is DevOps's, after deploy)

**Consistency check**:
`checks/consistency.mjs`: confirms the contract's bindings and routes, the copy deck and the design
name the same screens, routes and string ids. A failing run blocks the Engineer's start
(`consistency-gate`).
_Avoid_: analyze, cross-check, reconciliation

**Waiver**:
A `waived: <check> <reason>` line in a build's state file, written by Joel only, that lifts one
check for that build because the check itself is wrong.
_Avoid_: override, bypass, exception

**Standing clause**:
A rule a mid-build retro marked `BINDS THIS BUILD`, carried in every later brief to the stages it
names until the build closes.
_Avoid_: hotfix, override

**Model table**:
The `models:` block of a build's state file: one row per role, naming the Claude Code model alias
that role runs on. Starts at the defaults in `checks/models.mjs`; a row changes only when Joel
asks, for that build (v0.4).
_Avoid_: model config, routing table

**Tier**:
One model in the order `fable`, `opus`, `sonnet`, `haiku`, most capable first. The **top tier** is
`fable`, and only the Orchestrator runs on it.
_Avoid_: layer (a layer is one of Security's review steps), level

## The contract

**Contract**:
The Architect's binding specification for one build, kept as one file per part in `contract/`:
written spec, bindings, data model, API, platform (stack and escalation flag), and amendments.
_Avoid_: spec (one section of it), plan, design

**Amendment**:
A dated change to the contract, by the Architect only: an edit in place to a section file that
strikes through what it supersedes, plus an entry in `amendments.md` with the reasoning and routing. **Amendment set**: amendments appended together, routed together.
_Avoid_: patch, revision, change request

**Binding**:
A row in one of the contract's binding tables (flow, screen), and the thing QA drives.
_Avoid_: mapping, link

**Existing**, **Changing**, **New**:
A brownfield binding's status: kept as built, altered by this build, or created by it.
_Avoid_: legacy, modified, added

**Working**, **Read-verified**, **Wired-but-broken**, **Unwired**:
The survey's status for a flow found in the codebase. Working needs runtime evidence; read-verified
means only that both ends read as correct.
_Avoid_: done, verified, broken, as unqualified statuses

**Copy deck**:
The Copywriter's `copy.md`: every string a user of the build reads, by id, written before any
screen is drawn and shipped verbatim.
_Avoid_: copy doc, content, microcopy file

**Figure**:
Any number, percentage, price, date, duration, count, ranking, quote, named client, named source or
claimed result in copy. Always marked `source`, `bound` or `NEEDS SOURCE`.
_Avoid_: stat, data point

**Figure check**:
The Orchestrator's check of every figure in the copy deck against its cited source, recorded in
`log.md` and on its own state line, `stage-1.5-figure-check`. Reopened by every Copywriter pass.
_Avoid_: source check, fact check, verification

**Motion section**:
The part of `design.md` that says how the interface moves: motion tokens, every component's hover,
press and focus states, every loading indicator and every entrance, within limits L1 to L9 in
`agents/designer.md`. Folded in from the Motion stage, which never ran.
_Avoid_: motion spec, animation doc, transitions file

**State layer**:
A pseudo-element over a control whose opacity rises on hover and press, so a tone shift animates
on the compositor rather than repainting the control.
_Avoid_: overlay, hover tint

**Writer**:
Whatever creates, changes or ends a row or column: a flow, a trigger, a seed or an external owner.
_Avoid_: producer, source

**Test target**:
The database and project a build's tests run against, never the one production reads.
_Avoid_: test environment, staging, sandbox

## Findings and learnings

**Gap**:
QA's report that the build and the contract differ, in the `GAP` block, classed `bug` or
`spec-gap`.
_Avoid_: issue, defect, failure

**Finding**:
Security's report of a vulnerability, in the `FINDING` block, `blocking` or `non-blocking`.
_Avoid_: vuln, issue, gap

**Clarification**:
The Engineer's question to the Architect about an ambiguous clause, in the `CLARIFICATION` block.
_Avoid_: question, query

**Blocking**, **Degraded**:
Preflight's result for a capability: a stage cannot proceed without it, or a named substitute
covers it with a stated blind spot.
_Avoid_: missing, partial

**Learning**:
An entry in `LEARNINGS.md`, identified `<code>-<n>`: what happened, why it recurs, and the change.
_Avoid_: lesson, retro item, "entry 13" (always give the code)

**Known gap**:
A learning whose change has not yet reached the file it names, listed in `CLAUDE.md`. Always the
two words; "gap" alone is QA's.
_Avoid_: open item, backlog item, gap

**Run record**:
The final state block of a build, copied into `builds/<build-name>/run-record.md` when it closes.
_Avoid_: report, summary

**Log**:
A build's append-only `builds/<build-name>/log.md` of dated notes.
_Avoid_: notes, journal
