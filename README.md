# Agent development squad — v0.3

A template repository. Point `/squad` at a repo, give it a sketch, and a seven-role agent pipeline
turns it into a deployed application.

Intake is a hand-drawn sketch, an app name and a voice note. Output is a running app with a
binding technical contract, a test suite generated from that contract, a security review and a
deploy record.

---

## Using it

`/squad` is the only way in. The template's own "Use this template" button makes a fork that records
no version, cannot upgrade and never sends its learnings back, so it is not used.

1. **New app:** create an empty private GitHub repo and open it in Claude Code. **Existing app:**
   open its repo, with a clean working tree.
2. Run `/squad`. It stamps the pipeline into `.squad/` at the current release, installs the git
   guard, and commits both.
3. **New app:** give it the sketch, the app name and the voice note in one turn. **Existing app:**
   it surveys the code first and puts what it found to you as a draft intake.
4. It runs. It pings you only when a halt trigger fires.
5. After the build, `/squad port` sends that repo's new learnings back here.

```
your-app/                      the host repo
├── .squad/                    the pipeline, stamped at a pinned version
│   ├── CLAUDE.md              Orchestrator brief — run order, halt triggers, caps
│   ├── LEARNINGS.md           Why each version differs from the last
│   ├── VERSION                template, ref, commit and stamp time
│   ├── agents/                One file per role — each is that agent's entire world
│   │   ├── surveyor.md        0.25 · brownfield audit
│   │   ├── preflight.md       0.5  · tooling probe
│   │   ├── architect.md       1    · the binding contract
│   │   ├── designer.md        2    · UI, tokens, components
│   │   ├── engineer.md        3    · implementation
│   │   ├── qa.md              4    · tests generated from the contract
│   │   ├── security.md        5a/5b · pre- and post-deploy
│   │   ├── devops.md          6    · deploy and rollback
│   │   └── retro.md           7    · writes learnings back
│   ├── skills/                Invoked by path during a build, never auto-triggered
│   ├── state/                 tasks.md template; <build-name>.md while a build runs
│   └── builds/<build-name>/   One folder per build — the audit trail
├── .claude/hooks/             the git guard
├── docs/adr/                  decisions the Architect records
└── …                          the app itself
```

The template repository also holds `BLUEPRINT.md`, `PRIOR-ART.md` and `GLOSSARY.md`. No stage
loads them, so `/squad` does not stamp them.

---

## The three ideas it runs on

**The contract binds.** Stage 1 produces exact schema, exact routes, exact function signatures.
Every later stage is held to it, and inference is banned as a way to resolve ambiguity — an
Engineer who is unsure asks the Architect rather than guessing.

**Narrow context per stage.** Firing a stage loads that agent's file, the contract and the state
file. Never the whole repo. It keeps each agent sharp and cheap.

**Loops are capped, and state lives in a file.** Every fix loop has an iteration limit, and hitting
it halts with full context rather than retrying forever. Progress lives in the build's own
`state/<build-name>.md`, so a run survives a dropped session, a model swap or a restart.

---

## What v0.3 changed

v0.2 then ran on three more apps, two of them brownfield builds through `/squad`, and their
learnings piled up on three branches unapplied. v0.3 consolidates all 51 into
[LEARNINGS.md](LEARNINGS.md), under IDs by app, and applies every one. The load-bearing ones:

**Every screen is compared with its drawing.** A build passed every test and shipped the wrong
navigation shell, because no stage looked at a screen. The Designer now indexes a frame per
surface, and the Engineer and QA each check the built screen against it.

**Nothing tests on production.** The contract names a test target that is never the project
production reads, and previews point at it too.

**The contract binds how state comes to exist.** A writers table names what creates, changes and
ends every table and column; one build could manage clients it had no way to create.

**Evidence has to be able to fail.** A test counts only once seen red, a smoke check is shown
failing on the previous deployment, and a privilege is proven by attempting the write.

**One state file per build, and learnings go home.** Each build keeps its own state file, and
`/squad port` carries a host run's learnings back to this template, with a gap row for each.

---

## What v0.2 changed

v0.1 shipped a real application end to end and produced a list of defects in itself. All of them
are in [LEARNINGS.md](LEARNINGS.md) with evidence. The load-bearing ones:

**Flow bindings are mandatory.** v0.1's contract described flows in prose and routes in tables.
Prose is not testable, so QA tested the tables — every route responded, every screen rendered, 31
tests passed, and the deployed app could not create a quote, because nothing wired the button to
the route. The contract now binds flow → screen → control → route → post-condition as a table QA
can drive.

**Preflight runs before the Architect.** v0.1 discovered missing tooling at the moment each stage
needed it. Preflight probes it in seconds and records plan tiers, because a service's plan changes
what later stages can do.

**Caps count code defects, not environmental ones.** Two of v0.1's fix-loop failures were stale
builds, not bugs. A cap that counts those escalates working builds.

**Security runs twice.** Its first-pass tool is hosted-only and Stage 5 is pre-deploy. Those facts
are incompatible, so the stage splits either side of the deploy.

**Silent passing is banned.** An absent tool and a clean tool look identical, and that fails toward
a false pass. Every check now reports what it ran, not only what it found.

---

## Default stack

Next.js on Vercel, Supabase for database, auth and storage, 21st.dev for components in production
mode. Deviating requires an escalation trigger to have fired and a written justification — see
`skills/stack-decision.md`.
