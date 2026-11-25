# Rules every stage follows

Loaded with every stage, alongside that stage's own file. Each rule here binds every stage that
does the thing it names, and appears nowhere else: a stage file that needs one points here rather
than restating it (v0.4). Why each rule exists is in `LEARNINGS.md`, under its ID.

---

## The contract you load

The contract is a folder, `/builds/<build-name>/contract/`, one file per part. Load the files your
stage file's *Input* names, and no others.

| File | Holds |
|---|---|
| `spec.md` | Mode, fidelity, build class, screens, flows, entities, auth, first user, runtime secrets, residency, unverified premises, host constraints |
| `bindings.md` | Flow bindings and screen bindings |
| `data-model.md` | Schema, writers, self-consistency, tenant references, migration ordering |
| `api.md` | The common error shape and every route |
| `platform.md` | Stack, test target and strategy, plan tiers, platform settings, escalation flag |
| `amendments.md` | Each amendment's reasoning and `Routes to` table |

The section files are always current: an amendment edits them in place and strikes what it
supersedes (B3-6). Load `amendments.md` only when your state line names an amendment set, and read
that set's entries only. Only the Architect edits any contract file.

---

## How a fact is known

Every figure or environment fact you write in a finding, a record or a clarification says how and
when you obtained it: **observed, counted, classified or deduced** (B3-19). Keep observed and
deduced apart; a cause you inferred, written as though you saw it, sends the fix to the wrong
place.

A time is given in Joel's zone, Australia/Sydney, computed from the clock
(`TZ=Australia/Sydney date`), never read off a container's UTC. Re-verify an environment fact a
brief gives you before relying on it.

## Re-probe an MCP write before relying on it

Preflight's answer was true when it probed (WH-14). Immediately before a step that depends on an
MCP write, probe it again. A refusal is recorded `cause: environment` in `log.md`, not a halt.

## The test target is never production

Every test, fixture, migration and seed runs against `TEST TARGET` in `contract/platform.md`, a
project no production deployment reads (B3-3). If you cannot reach it, that is a blocking finding,
never a reason to point at production.

---

## Fix loops

Applies to any stage in a capped loop with the Engineer: QA, Security, and the Architect's
validation redo. Your stage file states your cap; `CLAUDE.md` holds the binding numbers.

**What counts as an iteration** (B3-14). One round trip on a finding: you report it, the Engineer
changes code, you re-check. These are not iterations: a pass with no code change, a regeneration
or re-review after an amendment, repairing your own test or rule, an environmental rerun. The cap
halts when the finding is still open after the Nth fix; an Nth iteration that ends green is done.

**Every iteration records its cause**, in `log.md`:

```
cause: code | environment | test-defect
```

| Cause | Meaning | Consumes the cap? |
|---|---|---|
| `code` | The build is wrong | Yes |
| `environment` | A stale build or server, a scan of the wrong tree, a missing tool or dependency | No. Logged |
| `test-defect` | Your own test, rule or probe asserts something the contract does not require (WH-24) | No. Recorded, never fixed silently |

**Before recording a re-check as a failure, confirm the binary or tree under test contains the
fix.** Build 1 lost two of three iterations to a stale binary and a stale server.

---

## Writing to the tree

Commit by explicit path, never `git add -A` or `git add .` (B3-15). Never commit while another
stage is writing the tree. While you are the Engineer or QA and your line is active, declare your
commits as yours: `SQUAD_STAGE=<your state line, e.g. stage-3-engineer> git commit -m "…"`.
Push the build's branch after each commit, so the record survives a lost worktree.

Edit the state file with the Edit or Write tool, never from Bash (B3-13).

## When a check blocks you

The git guard and the squad checks run before your tool calls, and a block has no bypass. Record
the blocked command, the check's message and why you needed it in `log.md`, and stop; the
Orchestrator escalates it. If you believe the check itself is wrong, say so with
`cause: test-defect`. Never write a `waived:` line: only Joel waives a check. If he has, `git pull`
and retry.
