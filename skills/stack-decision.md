# Skill — Stack decision

**Loads when:** the Architect names this file at Stage 1. Once per build, by path.
**Does not load:** on keyword match, at any other stage, or on a clock.

This file is read because an agent file pointed at it, never because something in a prompt looked
relevant. That is deliberate: the orchestrator's value is a predictable, auditable run, and a
procedure that loads itself on a keyword match is neither. See `../CLAUDE.md`.

---

## Input

The written spec and data model from the Architect's own Stage 1 work. Run this **after** you know
what the app does and what shape its data is, not before. Running it on the app name alone
produces a guess wearing a decision's clothes.

## Output

Two things, both written into `contract.md`:

1. The stack, stated explicitly — including when it is the default.
2. `escalation: yes|no`, with reason.

---

## Step 1 — Test each escalation trigger

Answer all five. Do not stop at the first `no`.

### Trigger 1 — concurrent editing of shared state, where simultaneous edits must merge

**Escalate on:** collaborative document editing, shared canvases, anything where two users changing
the same object at the same moment needs conflict resolution — operational transform or CRDTs.

**Do not escalate on:** live-updating dashboards, presence indicators, notifications, activity
feeds, chat. Supabase Realtime covers Postgres change streams, broadcast and presence on the
default stack, and Vercel Functions hold WebSocket connections on Fluid Compute with standard
libraries. None of that needs a separate socket server.

The word "realtime" in a voice note is not the trigger. The merge-conflict problem is.

### Trigger 2 — work that cannot be decomposed into sub-300s units, or needs a specialist runtime

**Escalate on:** video transcoding, ML training or inference at size, anything GPU-bound, anything
requiring a process that stays resident between requests and holds state in memory.

**Do not escalate on:** batch work that chunks into units under 300 seconds, scheduled jobs,
webhook fan-out, background email, document generation. Vercel Queues gives durable at-least-once
delivery on the default stack; functions run to 300s, packages to 5GB, request bodies to 100MB.

"Background job" is not the trigger. Work that will not fit in the box is.

### Triggers 3, 4 and 5

| # | Trigger | Question to answer |
|---|---|---|
| 3 | Non-relational or graph-shaped data at meaningful scale | Does the data model fight against tables — deep hierarchies, arbitrary traversal, schemaless documents at volume? |
| 4 | Named third-party integration that conflicts with the default stack | Does the spec name a service that requires infrastructure the default stack does not provide? |
| 5 | Low confidence about which category applies | Are you unsure whether any of 1–4 fires? |

**Any one `yes` → escalate.** Halt the pipeline. Output goes to Joel before Design or Engineering
begin.

Trigger 5 is deliberate: default to flagging over guessing. The whole value of this gate is that it
fires *before* Design and Engineering effort is sunk. A false flag costs one message. A missed
trigger costs the build.

### Why 1 and 2 survived being narrowed

Both were originally justified on platform limits that no longer hold — serverless not holding
socket connections, and short function timeouts. Those claims are dead, but the triggers are not,
because what actually makes these two worth a human eye is that they change the *shape* of the
system rather than its size. Conflict resolution is a correctness problem that leaks into the data
model. A resident stateful process is a second deployment target with its own failure modes. Both
are decisions someone should make on purpose.

Narrowing them matters as much as keeping them: a gate that escalates every dashboard with a live
counter trains everyone to wave escalations through, which costs more than the gate saves.

---

## Step 2 — If no trigger fired

Proceed on the default stack. No further sign-off from Joel is needed, and asking for one is a
defect.

```
Frontend:                Next.js
Hosting:                 Vercel
Database, auth, storage: Supabase
UI components:           21st.dev MCP  (anything beyond a throwaway prototype)
```

Write it into `contract.md` explicitly anyway. "Default stack" is not a record; the four lines
above are.

### Also record the plan tier — v0.2

For every service, state the **plan** and its operative limits, not just the product. Plan limits
change what later stages can do and are invisible until they bite.

```
Supabase:  free — 2 active projects, sleeps after ~1 week idle, NO cloud branching
Vercel:    pro  — commercial use permitted
21st.dev:  paid — no retrieval cap
Figma:     Full seat on Pro — Dev Mode MCP available
```

In build 1 the Supabase free tier had no cloud branching, which invalidated QA's per-build
database-branch design *after* it was written. A stack whose plan cannot support the contract's
requirements is an escalation trigger in its own right.

---

## Step 3 — If you deviate

Deviation is only legal when a trigger fired. The written justification must name:

1. **Which trigger** fired, by number.
2. **The specific thing** in this build that fires it — quote the spec.
3. **What the default stack would fail to do**, concretely.
4. **What you propose instead**, and what it costs.

### The validation pass will reject

- "Supabase felt like overkill."
- "The client prefers X."
- "This seemed like a better fit."
- "For scalability."

### The validation pass will accept

> Trigger 2. The spec requires transcoding uploaded video to three renditions before the item
> becomes visible, at up to 40 minutes of source per job. This exceeds the 300s function timeout
> and needs a persistent worker with a queue, which the default stack does not provide. Proposing a
> dedicated worker service alongside the default stack rather than replacing it, so auth, database
> and hosting stay unchanged.

**Cap: 2 redos** on a thin justification. On the third, the Orchestrator escalates to Joel with all
attempts.
