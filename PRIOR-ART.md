# Prior art — external sources worth mining

Public projects solving problems this pipeline also has. Recorded so a rule imported from outside
carries the same evidence trail as a rule derived from a build.

**Not loaded by any stage.** Like [BLUEPRINT.md](BLUEPRINT.md), this file is never in an agent's
context. It is Mode 2 material — read when changing a rule, not when running a build. A stage that
loaded it would be reading somebody else's checklist alongside its own brief with no way to tell
which binds.

**Everything here is verified at README level only, as at 2026-08-22.** Nobody has read these
projects' source. Treat every fact below as dated evidence, not as a guarantee, and re-check before
acting on it — the same rule that applies to tool facts in the stage files.

---

## The mining rule

Nearly every rule in this repo exists because a documented failure justified it. `LEARNINGS.md`
carries the evidence for each one, and [CLAUDE.md](CLAUDE.md) forbids removing a rule without
reading its entry.

**Importing a checklist wholesale is the same error pointed the other way.** A rule adopted because
a popular repo has it has no evidence behind it here, and nobody will be able to argue it back out
later.

So:

1. Take **mechanisms**, not files. One at a time.
2. Record the provenance in the stage file — "adapted from `<source>`, `<date>`" — the same way
   `LEARNINGS.md` entries carry theirs.
3. Log the adoption at the bottom of this file.
4. If a mechanism does not fit a failure this pipeline has actually had, do not take it yet. Write
   it in the entry's **Take** line and leave it there until a build produces the evidence.

---

## 1. `github/spec-kit` — spec-driven development toolkit

**Verified 2026-08-22.** 130.7k stars, active, v1.0.0 reached one year after inception. License not
checked. Seven-phase cycle producing a markdown artifact per phase:
`constitution → specify → plan → tasks → implement → converge`, plus optional `clarify`,
`analyze`, `checklist` and `taskstoissues`. Works across 30+ coding agents.

**Why it matters here.** It is the same thesis as this repo — a written specification, not a chat
prompt, is what the agent implements against — at a scale that makes its vocabulary the default one
people arrive with. Its "constitution" is this repo's [CLAUDE.md](CLAUDE.md) plus
[LEARNINGS.md](LEARNINGS.md).

**Take — `analyze`, the cross-artifact consistency pass.** This pipeline validates each stage's
output *against the contract*. Nothing checks that `contract.md`, `design.md` and `build-notes.md`
agree with *each other*. That is a distinct failure mode, and it is plausibly how LEARNINGS 1
survived: every artefact was internally consistent and no pass compared them. A Stage 3.5 modelled
on `analyze` would close it. Not yet adopted — no build has produced evidence for the specific
shape it should take.

**Take, weaker — `converge`.** Assess the built thing against spec/plan/tasks and append the delta
as new work. Stage 4 QA already does a stricter version of this against the contract, so the gain
is small.

**Do not take — the phase vocabulary.** `specify/plan/tasks/implement` does not map onto seven
named roles with their own briefs, and renaming stages to match a popular toolkit would break every
cross-reference in this repo for no behavioural gain.

**Note the divergence, and keep it.** Spec Kit validates spec-vs-build *after* implementation and
does not bind acceptance criteria at the template level. That is LEARNINGS 1, unfixed, in a
130k-star project. The flow binding table in [agents/architect.md](agents/architect.md) is ahead of
it on the critical defect. Do not trade it away for alignment.

**Status:** not adopted.

---

## 2. `OWASP/secure-agent-playbook` — agent security procedures

**Verified 2026-08-22.** 153 stars, 17 forks, 84 commits, actively maintained under the OWASP
Foundation. **CC-BY-4.0**, so text can be adapted into this repo with attribution. Three layers:
**Agents** (focused prompts producing structured reports) → **Skills** (self-contained procedure
summaries) → **Plays** (full procedures with checklists, decision tables and finding templates).
Tier 1 ships AI/Agent Security (7 plays) and Code & Dependency Analysis (8 plays); tiers 2–5 are
planned, not written.

**Why it matters here.** It is the closest thing to a public answer for the gap named in
[CLAUDE.md](CLAUDE.md)'s managed-agent discussion: when the build target is an agent rather than a
web app, Stage 5 loses Supabase advisors — its cheap, automated, expensive-and-obvious-catching
first pass — and has no equivalent. Three of its plays are exactly the missing checks: **prompt
injection testing**, **MCP server review**, **multi-agent threat modeling**.

Its structure is also independent confirmation that this repo's shape is sound: OWASP's
Skills-reference-Plays split is the same pattern as `/skills/*.md` invoked by path by the stage that
needs them, and its finding template — severity, CWE mapping, evidence snippet, remediation — is
the `FINDING` block in [agents/security.md](agents/security.md) with a CWE field added.

**Take — the three AI/Agent Security plays**, as the substance of a managed-agent Stage 5 brief,
whenever that brief gets written. Adapt, cite, and add the CWE field to the existing `FINDING`
block while you are there.

**Do not take — the agent/skill/play packaging.** This repo already has that split under different
names. Importing a second one creates two vocabularies for one idea.

**Watch:** tiers 2–5 are unwritten. Do not build a stage that depends on a play that does not exist
yet.

**Status:** not adopted. Blocked on the managed-agent target existing at all.

---

## 3. `strands-agents/evals` — agent evaluation framework

**Verified 2026-08-22.** **Standalone — not coupled to the Strands SDK**; it accepts any task
function and any agent, so it can grade an agent this pipeline built. Star count not checked.
Evaluators: `OutputEvaluator` (free-text rubric, Claude as default judge), `ToolSelectionAccuracy`,
`ToolParameterAccuracy`, and `TrajectoryEvaluator` with **exact-match / in-order / any-order**
scorers. Scores are 0.0–1.0; pass/fail thresholds are the implementer's to define.

**Why it matters here.** Stage 4 is a pass/fail gate — *"'Looks done' carries no weight"* — and that
gate assumes determinism. Agent behaviour is not deterministic, so a managed-agent QA brief needs a
different kind of gate, and this is the clearest public vocabulary for one.

**Take — the trajectory scorers, as the agent analogue of the flow binding table.** "Which tools,
with which arguments, in what order" is a gradeable post-condition. `in-order` versus `any-order` is
precisely the distinction a job binding needs and prose cannot express. That mapping is the single
most useful thing in this entry.

**Do not take — the framework itself**, at least not first. Adopting a Python eval harness makes the
generated build depend on it, and Stage 4 already owns its own harness by design.

**Known limit, and it is the important one.** It does **not** automate N-repetition or statistical
thresholding. "Run multiple evaluations to account for LLM non-determinism" is a best-practice note
in its docs, not a feature. So it does not solve this pipeline's hardest open question — how many
runs, at what threshold, and what a cap of 3 iterations means when failure is a score rather than a
red test. That number has to come from a real build.

**Status:** not adopted.

---

## 4. Unverified leads — the N-run variance problem

Recorded because they claim the thing entry 3 lacks. **Neither has been checked beyond a search
result. Verify before citing.**

| Source | Claim, as at 2026-08-22 | Why it might matter |
|---|---|---|
| `Kareem-Rashed/rubric-eval` | Repeated runs with flakiness detection, reports score variance | The missing half of entry 3 |
| `promptfoo` | Deterministic assertions **and** model-graded rubric assertions in one config | A QA stage grading an agent needs both kinds at once |

Provenance on the first is unknown and the repo is small. Do not put either in a stage file on the
strength of a README.

---

## Deliberately not adopted

Recorded so the same evaluation is not repeated in six months.

**The `awesome-claude-code-subagents` collections** — VoltAgent (100+ agents), `lst97`, `mylee04`,
`rahulvrane` and similar. These are prompt libraries. The agent files in this repo carry loop caps,
dated tool facts, worked evidence and the specific failure each rule came from; typical entries in
those collections carry a role description and a tone. Importing from them dilutes.

**`zhsama/claude-sub-agent`** — a multi-agent spec workflow built on Claude Code sub-agents. Same
idea as this repo, built differently. Worth reading once as a comparison. Nothing to adopt.

---

## Adoption log

One line per mechanism actually taken, appended, never overwritten. Empty until something is.

```
<date>  <mechanism>  from <source>  →  <file and section>
```
