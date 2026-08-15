# Agent development squad — v0.2

A template repository. Generate a new repo from it, drop in a sketch, and a seven-role agent
pipeline turns it into a deployed application.

Intake is a hand-drawn sketch, an app name and a voice note. Output is a running app with a
binding technical contract, a test suite generated from that contract, a security review and a
deploy record.

---

## Using it

1. **Use this template** → create a private repo for your build.
2. Open it with Claude Code. `CLAUDE.md` is the orchestrator's brief and loads automatically.
3. Give it the sketch, the app name and the voice note in one turn.
4. It runs. It pings you only when a halt trigger fires.

```
your-build/
├── CLAUDE.md              Orchestrator brief — run order, halt triggers, caps
├── BLUEPRINT.md           Original design document. History, not instruction
├── LEARNINGS.md           Why v0.2 differs from v0.1. Read before changing rules
├── agents/                One file per role — each is that agent's entire world
│   ├── preflight.md       0.5 · tooling probe          (v0.2)
│   ├── architect.md       1   · the binding contract
│   ├── designer.md        2   · UI, tokens, components
│   ├── engineer.md        3   · implementation
│   ├── qa.md              4   · tests generated from the contract
│   ├── security.md        5a/5b · pre- and post-deploy (v0.2)
│   ├── devops.md          6   · deploy and rollback
│   └── retro.md           7   · writes learnings back  (v0.2)
├── skills/                Invoked by path during a build, never auto-triggered
├── state/tasks.md         Live pipeline state. Survives a dropped session
└── builds/<app-name>/     One folder per build — the audit trail
```

---

## The three ideas it runs on

**The contract binds.** Stage 1 produces exact schema, exact routes, exact function signatures.
Every later stage is held to it, and inference is banned as a way to resolve ambiguity — an
Engineer who is unsure asks the Architect rather than guessing.

**Narrow context per stage.** Firing a stage loads that agent's file, the contract and the state
file. Never the whole repo. It keeps each agent sharp and cheap.

**Loops are capped, and state lives in a file.** Every fix loop has an iteration limit, and hitting
it halts with full context rather than retrying forever. Progress lives in `state/tasks.md`, so a
run survives a dropped session, a model swap or a restart.

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
