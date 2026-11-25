# Build folder template

Copy this folder to `/builds/<build-name>/` at the start of every build. One folder per build, named
for the app.

This is the per-build audit trail. Nothing else belongs here — no scratch files, no drafts, no
conversation exports.

| File | Written by | Stage |
|---|---|---|
| `survey.md` | Surveyor | 0.25 — brownfield only |
| `preflight.md` | Preflight | 0.5 |
| `contract/` | Architect | 1 — `spec.md`, `bindings.md`, `data-model.md`, `api.md`, `platform.md`, `amendments.md` |
| `copy.md` | Copywriter | 1.5 |
| `design.md` | Designer | 2 |
| `build-notes.md` | Engineer | 3 |
| `test-results.md` | QA | 4 |
| `tests/` | QA | 4 |
| `security-review.md` | Security | 5a, updated at 5b |
| `deploy-record.md` | DevOps | 6 |
| `run-record.md` | Orchestrator | on completion — copy of the final `/state/<build-name>.md` block |

The contract is binding on every stage after 1. Amendments are edits in place to the section
files, with a dated entry in `contract/amendments.md`, by the Architect only.

**Delete this README when you copy the folder.** It describes the template, not the build, and
leaving it behind means every build folder opens with a page about folder structure instead of the
contract.
