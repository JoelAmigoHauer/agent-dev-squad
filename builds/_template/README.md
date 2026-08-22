# Build folder template

Copy this folder to `/builds/<app-name>/` at the start of every build. One folder per build, named
for the app.

This is the per-build audit trail. Nothing else belongs here — no scratch files, no drafts, no
conversation exports.

| File | Written by | Stage |
|---|---|---|
| `preflight.md` | Preflight | 0.5 |
| `contract.md` | Architect | 1 |
| `design.md` | Designer | 2 |
| `build-notes.md` | Engineer | 3 |
| `test-results.md` | QA | 4 |
| `tests/` | QA | 4 |
| `security-review.md` | Security | 5a, updated at 5b |
| `deploy-record.md` | DevOps | 6 |
| `run-record.md` | Orchestrator | on completion — copy of the final `/state/tasks.md` block |

`contract.md` is binding on every stage after 1. Amendments are made to the file itself, dated, by
the Architect only.

**Delete this README when you copy the folder.** It describes the template, not the build, and
leaving it behind means every build folder opens with a page about folder structure instead of the
contract.
