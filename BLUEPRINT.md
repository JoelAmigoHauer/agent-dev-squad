# Multi-agent build pipeline, blueprint
Owner: Joel Hauer / We Are Visionists
Purpose: Turn a sketch, app name and voice note into a deployable, production-safe application via a structured seven-role agent pipeline, with minimal manual intervention from Joel.
This is the design document. It describes a multi-file repo without being multi-file itself. Paste it into Claude with the instruction: "Scaffold this repo." Section 9 defines the exact structure to generate.
---
## 1. Stage 0: Intake
Input: hand-drawn sketch (image), app name, voice note describing function.
No separate parsing agent. Claude (vision-enabled) reads the sketch and transcribes and interprets the voice note directly in the same turn that kicks off the Solution Architect agent.
---
## 2. Stage 1: Solution architect agent
Role: Convert raw input into a binding technical contract. This agent makes decisions and defines structure only. Code and UI belong to later stages.
Output required (all fields mandatory):
1. Written spec: screens, user flows, core entities, auth requirements.
2. Data model: exact tables, fields and types, written as schema rather than prose.
3. API contract: exact routes, request and response shapes, function signatures.
4. Stack decision (decision tree below).
5. Escalation flag: yes/no, with reason, if the build falls outside default stack capability.
### Default stack decision tree
Deviate only when a trigger condition is met. Any deviation must be justified in writing in the output.
Default stack:
- Frontend: Next.js
- Hosting: Vercel
- Database, auth, storage: Supabase
- UI components: 21st.dev MCP (component library) for anything beyond a throwaway prototype
Escalation triggers (any one means: flag for manual stack review and halt):
- Real-time multiplayer or live collaborative editing (serverless can't hold long-lived socket connections)
- Long-running or heavy background jobs (video processing, large batch work, anything needing a persistent worker or queue)
- Non-relational or graph-shaped data at meaningful scale
- A named third-party integration that conflicts with the default stack
- Any case where the architect lacks confidence about which category applies (default to flagging over guessing)
If no trigger fires: proceed on the default stack with no further sign-off from Joel.
If a trigger fires: pipeline halts here, output goes to Joel before Design or Engineering begin.
### Validation pass
Cheap, automatic, no separate role. Before this output moves downstream, run one check: does the stack choice match the decision tree, and if it deviated, is the written reason substantive? If the reason is thin, kick back to the Architect for a redo. Max 2 redos, then escalate to Joel.
---
## 3. Stage 2: Product designer agent
Role: Turn the sketch and the Architect's screen list into actual UI. Two fidelity modes.
**Mode A, fast pass** (prototype speed, part of the 30-minute build target):
Claude generates layout and components on the fly directly from the sketch, with no external design library lookup. Optimised for speed over polish.
**Mode B, production pass** (anything going live):
Query 21st.dev MCP first for existing, proven components matching the spec (search and generate functions) before building screens. Assemble screens from that library so visual language and component behaviour stay consistent build to build.
If a Figma file exists or is created for the project: pull exact spacing, colour tokens and asset exports via Figma's Dev Mode MCP server. Requires a Dev or Full seat on a paid Figma plan; free tier and View/Collab seats are locked out or capped at 6 calls per month. This closes the fidelity gap between sketch and shipped UI, since the engineer works from real values rather than estimates.
---
## 4. Stage 3: Full-stack engineer agent
Role: Implement against the Architect's contract and the Designer's output. The structure already exists; this agent fills the scaffold.
Guardrails:
1. Works only from the typed contract in Stage 1 output (data model, API shapes, function signatures).
2. Pulls exact visual values from Figma MCP where available.
3. Uses 21st.dev components in production mode, for consistency and because accessibility and responsive behaviour are already solved there.
4. Generates TypeScript types straight from the Supabase schema rather than hand-writing them, which removes a whole category of mismatch bugs.
5. Any ambiguity in the contract gets flagged back to the Architect for clarification before implementation proceeds on that piece. Inference is banned as a resolution method.
---
## 5. Stage 4: QA agent
Role: Verify against the Architect's spec. "Looks done" carries no weight.
- Generates test cases from the Stage 1 spec before or during the build, then runs them against what the engineer produced. A real gate.
- Automated coverage of the API contract and core user flows.
- Flags gaps between spec and implementation explicitly. Silent patching is banned.
- Static checks (type checking, linting) run mechanically on every commit before merge.
### QA fix loop (capped)
QA finds a gap, kicks it back to the Engineer with the failing test and the relevant contract clause. Engineer patches. QA re-runs the full suite, never just the failed test.
- Done-condition: full suite green.
- Cap: 3 iterations. On the third failure, halt and escalate to Joel with the failing tests and the diff history. Uncapped loops are where agents burn hours re-fixing the same function.
---
## 6. Stage 5: Security and privacy agent
Role: Review auth implementation, data handling and any third-party integration (Stripe sandbox, Resend) against baseline practice before deploy.
- Runs in parallel with QA to avoid adding dead time.
- Uses Supabase's advisor checks (missing row-level security, exposed vulnerabilities) as a free automated first pass after every schema change.
- Checks: auth wired correctly, no exposed secrets, input validation on all routes.
### Security fix loop (capped)
Same shape as the QA loop. Cap: 2 iterations, tighter than QA because a security finding that survives one fix attempt usually signals a design problem, and design problems belong with Joel, at the Architect level.
---
## 7. Stage 6: DevOps / release agent
Role: Deploy to Vercel, wire environment variables, connect the Supabase project, confirm the build passes CI before going live. Owns the rollback path if a deploy fails.
Deploy loop cap: 2 attempts. A deploy that fails twice gets escalated with the build logs, never retried blind.
---
## 8. Stage 7: Orchestrator (technical PM)
Role: Sequences all agents, resolves conflicts between their outputs (for example Security blocking a pattern Design wants), and is the only point that pings Joel mid-pipeline. It pings only when:
- A stack escalation trigger fires (Stage 1), or
- Security and Design/Engineering genuinely conflict and need a human call, or
- QA finds a spec-vs-build gap that changes scope, or
- Any loop hits its cap.
Otherwise the pipeline runs end to end without manual checkpoints, by design.
The orchestrator holds no creative role. It reads and writes the state file (section 10), fires the next stage, and enforces caps. Mechanical by design, so its behaviour is predictable and auditable.
---
## 9. Repo structure
The running system lives in a repo shaped like this. One markdown file per agent, root CLAUDE.md as the orchestrator's brief.
```
/pipeline
  CLAUDE.md                 Orchestrator brief: run order, halt triggers,
                            loop caps, pointer to every agent file as
                            required reading
  /agents
    architect.md            Role, decision tree, output contract
    designer.md             Fidelity modes, 21st.dev and Figma routines
    engineer.md             Guardrails, type generation, ambiguity rule
    qa.md                   Test generation rules, loop protocol
    security.md             Check list, advisor usage, loop protocol
    devops.md               Deploy sequence, rollback path
  /skills
    stack-decision.md       The decision tree as an invocable skill
    figma-pull.md           The exact Figma MCP extraction routine
    deploy-sequence.md      Vercel deploy steps, env wiring
  /state
    tasks.md                Live pipeline state (section 10)
  /builds
    /<app-name>             One folder per build: spec, contract,
                            test results, deploy record
```
Each agent file is that agent's entire world. When the orchestrator fires a stage, it loads only that agent's file plus the current contract and state, never the whole repo. Narrow context per stage is what keeps each agent sharp and cheap.
---
## 10. State file pattern
Borrowed straight from CI. Progress lives in `/state/tasks.md`, never in the conversation.
```
build: invoice-chaser
started: 2026-08-15T14:02
stage-1-architect:   done    (contract at /builds/invoice-chaser/contract.md)
stage-2-designer:    done    (mode B, 21st.dev components logged)
stage-3-engineer:    done
stage-4-qa:          loop 2/3 (2 failing tests, detail below)
stage-5-security:    done    (advisors clean)
stage-6-deploy:      pending
escalations:         none
```
Every stage writes its status and output location here on completion. This is what lets a long run survive a dropped session, a model swap, or a restart without drifting, and it makes the orchestrator's job reading a file rather than reconstructing history from chat. It's also your audit trail per build.
---
## 11. Skills versus scheduled tasks
| Type | Trigger | Examples |
|---|---|---|
| Skill | On demand, invoked during a build | Stack decision tree, Figma pull routine, deploy sequence, 21st.dev component search |
| Scheduled task | Clock, runs with nobody asking | Nightly security re-scan of deployed apps, weekly dependency staleness check across /builds |
The core build pipeline is all skills. The trigger is a sketch landing, never a clock. Schedules only enter for post-deploy upkeep of apps already live.
---
## 12. Goal state
| Build type | Expected outcome |
|---|---|
| Simple single-purpose app (CRUD plus auth, standard UI patterns) | Sketch, name and voice note in; deployed, configurable app out; roughly 30 minutes; minimal intervention |
| Anything hitting an escalation trigger | Pipeline flags early and cheaply at Stage 1, before Design or Engineering effort is sunk |
| Any loop hitting its cap | Halt with full context (failing tests, diffs, logs), never silent retries |
## 13. Connected tooling map
| Role | Tool | Status |
|---|---|---|
| Architect | Claude (vision intake, spec generation) | Connected |
| Designer | 21st.dev MCP, Figma Dev Mode MCP | Connected (Figma paid seat required for Dev Mode) |
| Engineer | Claude, GitHub, Supabase (schema plus generated types) | Connected |
| QA | Playwright or hosted equivalent | Gap, needs connecting |
| Security | Supabase advisors plus a second-pass scanner | Advisors available, second pass is a gap |
| DevOps | Vercel | Connected |
| Orchestrator | CLAUDE.md plus state file (LangGraph or script later if volume demands) | To be scaffolded |
