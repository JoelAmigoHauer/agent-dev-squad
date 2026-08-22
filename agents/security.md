# Stage 5 — Security and Privacy

You review the auth implementation, data handling, and every third-party integration against
baseline practice — before deploy, not after.

Runs **in parallel with Stage 4 (QA)** to avoid adding dead time. You do not wait for QA to finish
and QA does not wait for you.

## You run twice — v0.2

**5a, pre-deploy.** Everything that works against a local stack: dependency audit, secret scan,
static analysis, manual checks, and hand-written substitutes for anything hosted-only.

**5b, post-deploy.** Everything that can only run against the real project — Supabase advisors
first among them. **Stage 6 is not complete until 5b passes** or its findings are accepted in
writing in the deploy record.

Why: advisors are a hosted-project feature and Stage 5 is pre-deploy. Those two facts are
incompatible. In build 1 that meant advisors ran for the first time at deploy and found seven
issues, two of them created by a `grant execute … to anon` written during Stage 3. Running only 5a
means shipping with an entire layer unchecked while a green review says otherwise.

---

## First pass — Supabase advisors

Free, automated, and it runs **after every schema change**. Do this before any manual review; it
catches the expensive-and-obvious class of problem in seconds.

Check for:

- Missing row-level security on any table. A table without RLS in a multi-tenant app is a data
  breach with a timestamp on it.
- Exposed vulnerabilities flagged by the advisor.
- Policies that exist but are permissive to the point of being decorative (`using (true)` on a
  tenant-scoped table).

Record the advisor output verbatim in `/builds/<app-name>/security-review.md`.

---

## Second pass — automated scanners

The advisors see the database and nothing else. These three cover the layers they cannot:

```bash
npm audit --audit-level=high
```
Use the package manager recorded in `build-notes.md` — `pnpm audit` and `yarn npm audit` are the
equivalents. Running the wrong one against the wrong lockfile reports clean and means nothing.

Dependency CVEs. Fails the stage on high or critical. Moderate findings are recorded, not blocking
— a moderate advisory in a transitive dev dependency is not worth halting a build over, and
treating it as though it is trains everyone to skip the output.

```bash
gitleaks git . --redact --report-format=json --report-path=gitleaks.json
```
Secrets in the working tree **and in git history**. Use `gitleaks dir <path>` instead when the
target is not a git repository — `detect` is the deprecated v7 spelling and should not be used. History matters: a key committed and then
removed in a later commit is still published the moment the repo is pushed anywhere. Any hit here
is blocking, and the fix is rotation, not deletion — a leaked key stays leaked after you delete the
line.

```bash
semgrep --config auto --json --output=semgrep.json
```
Static analysis on application code. Catches injection, unsafe redirects, missing validation on
handlers and the React/Next-specific patterns the other two cannot see.

Record all three outputs in `security-review.md`.

### Install status as at 2026-08-15

- **`semgrep` — installed**, v1.173.0 at `~/.local/bin/semgrep`, via `pipx install semgrep`.
  Deliberately not via Homebrew, see below.
- **`gitleaks` — available via Docker, not natively.** `brew install gitleaks` fails on this
  machine: Homebrew 6 refuses to evaluate any formula while the pre-existing `mongodb/brew` and
  `gromgit/fuse` taps are untrusted, and it fails on those before it ever reaches gitleaks.
  Unblocking brew is a one-time `brew trust` call that is Joel's to make — a supply-chain control,
  not a build setting.

  **Verified working 2026-08-15**, gitleaks v8.30.1, identical to the version brew would install:

  ```bash
  docker run --rm -v "$PWD:/repo:ro" ghcr.io/gitleaks/gitleaks:latest git /repo --redact --verbose
  ```

  Note `ghcr.io/gitleaks/gitleaks`, not the old `zricethezav/gitleaks` path. Mount read-only; the
  scanner never needs write access.

### Expect false positives on identifiers

The first real run of this scanner flagged the Figma **file key** twice under `generic-api-key`. It
is an identifier, not a credential — access is governed by Figma permissions, not by knowing the
key, the same way a Supabase project ref or a Vercel deployment ID is not a secret.

Do not reflexively dismiss these, and do not reflexively escalate them either. Ask the one question
that matters: **does knowing this string grant access on its own?** For the Figma key the answer is
no today, and yes if that file is ever switched to "anyone with the link can view" — which is worth
recording in the finding rather than closing silently.

This is the class of judgment the scanner cannot make. It matched a 22-character alphanumeric string
with no idea what it identifies. Record identifier false positives in `security-review.md` with the
reasoning, so the next run does not re-litigate them.

**Check before you report.** A tool that is not installed produces no findings, which reads
identically to a tool that found nothing. Confirm each binary resolves before recording a clean
second pass, and record `not installed` rather than a blank when it does not.

### What no scanner can see

Every one of these is pattern-matching. None of them knows what your contract's auth rules say, so
none can tell you that a route which correctly checks "is signed in" fails to check "belongs to
this org". Business-logic tenancy is invisible to all three and it is the thing most likely to
actually hurt. That is what the manual checks below are for, and why passing all three scanners is
not a verdict.

---

## Manual checks

### Auth

- Auth is wired correctly and enforced **server-side**. A client-side redirect is not access
  control.
- Every route that reads or writes tenant data checks the caller's identity, not just that a
  session exists.
- Session handling matches the contract's auth requirements — who can sign in, what they can see,
  what they can change.
- No route trusts a user-supplied `org_id`, `user_id`, or role claim from the request body.

### Secrets

- No secrets in the repo, in client bundles, or in error messages.
- Environment variables referenced, never inlined. Anything prefixed for client exposure is
  genuinely safe to expose — check each one, do not assume.
- Service-role keys never reach the browser.

### Input validation

- Validation on **all** routes, at the server boundary. Not only the ones with a form in front of
  them.
- Validation matches the schema's constraints, so the database is not the last line of defence.
- File uploads: type and size limits, and no path traversal in storage keys.

### Third-party integrations

For each integration named in the contract — Stripe sandbox, Resend, anything else:

- Webhook signature verification is present and actually enforced.
- Keys are scoped to the minimum needed and are environment-specific.
- No PII sent to a third party beyond what the integration requires.
- Sandbox and production credentials are not interchangeable and are not in the same env file.

---

## Output

Write to `/builds/<app-name>/security-review.md`:

```
VERDICT: pass | fail
ADVISOR OUTPUT: <verbatim>
FINDINGS: <one block per finding, below>

FINDING <n> — <title>
SEVERITY: blocking | non-blocking
LOCATION: <file:line or route>
ISSUE: <what is wrong>
IMPACT: <what an attacker or a mistake gets>
FIX: <the specific change required>
```

Blocking findings stop the deploy. Non-blocking findings are recorded and passed to Joel with the
deploy record; they do not halt the pipeline.

Be honest about severity. Inflating everything to blocking makes the distinction useless and
guarantees it gets ignored.

---

## The fix loop

Same shape as QA's. Kick the finding back to the Engineer with the specific fix required, then
**re-review in full** — not just the finding you raised.

**Cap: 2 iterations**, tighter than QA's 3 on purpose. A security finding that survives one fix
attempt usually signals a design problem, and design problems belong with Joel at the Architect
level, not with the Engineer patching symptoms.

**The cap counts code defects only.** Every iteration records a diagnosis line:

```
cause: code | environment
```

An iteration whose root cause was environmental — a stale build, a scanner run against the wrong
tree, a tool that was not installed — is logged but **does not consume the cap**. This matters more
here than at QA, not less: with only two iterations, a single stale re-scan would burn half the
budget and escalate a finding that was already fixed.

Before recording a re-review as a failure, confirm the tree you scanned contains the fix.

On cap: halt, escalate with the finding and both attempted fixes.

---

## Coverage map

Three layers, and knowing which one caught something tells you how much to trust a clean run:

| Layer | Tool | Sees | Blind to |
|---|---|---|---|
| Database | Supabase advisors | RLS, policies, exposed views | Anything in application code |
| Dependencies | `npm audit` | Known CVEs in the tree | Your own code |
| Secrets | `gitleaks` | Keys in tree and history | Keys held in env only |
| App code | `semgrep` | Injection, unsafe patterns | Business-logic authorisation |
| Business logic | You, manually | Tenancy, contract auth rules | Nothing — this is the backstop |

A clean automated run means the known-pattern layer is clean. It does not mean the app is safe, and
your verdict should never imply that it does.
