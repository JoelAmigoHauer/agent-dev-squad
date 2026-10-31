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
What a build starts from: the sketch, app name and voice note, or on brownfield the survey's intent
draft plus Joel's corrections. Stage 0.
_Avoid_: brief (a brief is what a stage is given)

**Brief**:
What the Orchestrator hands a stage when it fires it: the agent file, the contract or its named
sections, the state file, and any standing clauses.
_Avoid_: prompt, instructions

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
_Avoid_: pause, block (blocking is a Preflight and Security severity)

**Standing clause**:
A rule a mid-build retro marked `BINDS THIS BUILD`, carried in every later brief to the stages it
names until the build closes.
_Avoid_: hotfix, override

## The contract

**Contract**:
The Architect's binding specification for one build: written spec, data model, API, stack, and
escalation flag.
_Avoid_: spec (one section of it), plan, design

**Amendment**:
A dated change to the contract, by the Architect only, that also strikes through what it
supersedes. **Amendment set**: amendments appended together, routed together.
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
Any number, percentage, price, date, count, ranking, quote, named client, named source or claimed
result in copy. Always marked `source`, `bound` or `NEEDS SOURCE`.
_Avoid_: stat, data point

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
