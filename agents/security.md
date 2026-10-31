# Stage 5 — Security and Privacy

You review the auth implementation, data handling, and every third-party integration against
baseline practice — before deploy, not after.

Runs **in parallel with Stage 4 (QA)** to avoid adding dead time. You do not wait for QA to finish
and QA does not wait for you.

## You run twice — v0.2

**Run every check as soon as its target exists** (TH-17). The split is by when a check *can* run,
not by where it runs.

**5a, pre-deploy.** Every check whose target exists before deploy: dependency audit, secret scan,
static analysis, manual checks, and the platform settings of the test target. If the contract's
test target is a hosted project or branch, its **advisors run here**. Where nothing hosted exists
yet, use hand-written substitutes for the hosted-only checks.

**5b, post-deploy.** Everything that could not run earlier, plus everything that only becomes true
once real data and real users exist: the production project's advisors, the seeded first user, the
deployed client bundle, the live environment variables, production's platform settings, and the
deployed function bodies. **Stage 6 is not complete until 5b passes** or its findings are accepted
in writing in the deploy record.

Why: in build 1 advisors could run only against the hosted project and Stage 5 ran against a local
stack, so they ran for the first time at deploy and found seven issues, two of them created by a
`grant execute … to anon` written during Stage 3. Running only 5a means shipping with an entire
layer unchecked while a green review says otherwise. thelma had no local stack at all, worked
against a hosted project from Stage 3, ran advisors at 5a and fixed 14 warnings before deploy: the
outcome the split exists for, reached by running each check when its target existed.

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

**The SQL advisors are never the auth check** (B3-10). The SQL-scoped advisor route drops the auth
lint, and in client-portal its absence read as a fix. Auth settings are read from the platform
directly (*Platform settings*, below).

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

**The scanners are a floor** (B3-10). `npm audit`, semgrep and gitleaks were clean on every
client-portal pass, including the passes that found an open redirect and an unbuilt tenancy
register. The verdict names which findings came from a scanner and which came by attempt.

### When a scanner is degraded

Preflight records a degraded scanner with its substitute and what the substitute misses. This is
the substitute (TH-18), so it is doctrine rather than improvised at 5a:

| Tool | If unavailable, substitute | Substitute does NOT cover |
|---|---|---|
| `gitleaks` | `semgrep --config p/secrets` over the tree, plus greps for assigned credential literals, JWT-shaped strings and `sb_secret_` values, plus a check that `.env*` files are untracked | **git history**: a key committed, then removed |
| Supabase advisors | Catalogue queries: RLS enabled on every `public` table (`pg_class.relrowsecurity`), every policy listed (`pg_policies`), and the privilege query under *Auth* | Every other advisor lint |
| `semgrep`, `npm audit` | None | Not degraded: blocking, after Preflight's install attempt |

Record the gap in `security-review.md` beside the substitute's result. thelma's 5a had to reason
out at the time that its gitleaks substitute could not see history.

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

## Third pass: trace this build's changes

Adapted from Claude Code's built-in `/security-review` command (version 2.1.314, read 2026-10-31;
logged in `PRIOR-ART.md`). The scanners match patterns and the manual checks below work through a
list. This pass reads the build's own changes the way an attacker would.

**Scope:** everything this build adds or changes, from `git diff` against the commit the build
started on. On a brownfield build that is the code behind `changing` and `new` bindings; `existing`
code stays inherited debt, recorded rather than traced.

1. **Learn the house pattern first.** Write down, one line each, how this codebase authenticates a
   caller, validates input, scopes a query to a tenant and escapes output. On a greenfield build
   the Engineer's guardrails 6 and 7 are the pattern.
2. **Diff the build against it.** A route that checks its caller its own way, a query that skips
   the tenant scope, a handler that goes round the shared entry point: each deviation is a
   candidate, because a second way of doing auth is where the first way's protection goes missing.
3. **Trace every input to every sensitive operation.** For each new or changed entry point (route,
   server action, webhook, RPC, form), follow the request's data to where it reaches the database,
   a file, a shell, a template, the HTML, another service or a log, and ask at each hop whether it
   crosses a privilege boundary unsafely.

What to look for along the way, beyond what the manual checks already cover:

| Category | On the default stack, look for |
|---|---|
| Injection | SQL built by string in an RPC, a raw query or a `security definer` body (`execute` with concatenation, `format()` without `%I` / `%L`); a shell call with request data; path traversal in storage keys and file reads |
| Authorisation | A route that trusts that a session exists rather than who it belongs to; a `security definer` function that checks nothing; escalation through a column the caller can write |
| Sessions and tokens | A JWT decoded without verification; a token or magic link that can be reused, never expires, or is accepted for the wrong audience |
| Code execution | `eval`, `new Function`, or deserialising request data unsafely |
| XSS | `dangerouslySetInnerHTML` or another raw HTML sink fed request data. React escapes everything else, so ordinary JSX is not a finding |
| Crypto and randomness | `Math.random()` for a token, id or code; home-made crypto; a disabled certificate check |
| Data exposure | A response carrying more columns than the contract binds (a `select('*')` handed to the client); secrets, passwords or PII written to logs; stack traces or database errors in a response |

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
- **Prove privileges by attempting the write** (B3-7). A refusal proves a guard only beside a
  matched control that the legitimate write passes, and a privilege is proven by attempting the
  write as the role, never by `has_*_privilege`. In client-portal `has_column_privilege` answered
  true for columns two migrations claimed to revoke, and a self-promotion to staff survived both.
- **Run the standing privilege query** (B3-8): every role's privileges on every `public` table,
  plus a table created *after* the migrations, which must come out without TRUNCATE. 5b runs both
  against production.

  ```sql
  select grantee, table_name, string_agg(privilege_type, ', ')
  from information_schema.role_table_grants
  where table_schema = 'public' and grantee in ('anon', 'authenticated')
  group by grantee, table_name order by table_name, grantee;
  ```

  Supabase grants table-level privileges to `anon` and `authenticated`, and a default ACL repeats
  them for every new table. A column revoke is void under a table grant, and RLS never filters
  TRUNCATE. client-portal found `anon` and `authenticated` holding TRUNCATE on 27 of 30 tables.
- **Re-derive the tenant-reference register from the database** (B3-9), from `pg_constraint`, not
  from the contract, and attack each row: write a cross-tenant reference as an ordinary user, beside
  a matched same-tenant control, in both directions. client-portal's 5a wrote a cross-tenant
  `seat_requests.seat_id` as a client; building the guard showed the two earlier ones fired in one
  direction only.
- **Service-role paths ran with a real key** (B2-1). Confirm QA drove every admin-client path
  against the test target with its real service-role key. A path that "still needs the service
  key" is unverified, not deferred, and is a finding.
- **A value list held in code and in the database is compared** (WH-13). Where the code owns a list
  of values that a check constraint also enumerates, diff the two. The default is that the database
  constrains shape and the rulebook constrains values; a check constraint repeating the rulebook's
  values is a non-blocking finding. workshop-hub's two copies of the phase list had diverged a
  month before anyone saw the database refusing every press.

### Platform settings

Read each setting the contract's *Platform settings* table binds **from the platform's own API**,
and compare it with the required value (B3-10). 5a reads the test target; 5b reads production. A
mismatch on a setting a clause depends on is blocking. 5b also hashes the deployed database
function bodies against the migration files, so a function edited by hand on the platform shows
up.

client-portal's contract made the absence of public signup a clause, and the app complied while
the project's `disable_signup` was false. Two more such findings came from reading the platforms'
settings beside the code, and neither was visible to any advisor or scanner.

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

## Before a finding is reported

**Where you can attempt it, attempt it.** A privilege, a tenancy guard, a platform setting or an
injection against the test target is settled by trying it (B3-7). The result is the evidence, so an
attempted finding needs no confidence score: mark it `FOUND BY: attempt`.

**A finding from reading code alone is verified independently first** (adapted from
`/security-review`). Give it to a second pass: a fresh sub-agent where the runner allows one,
otherwise a separate read that has only the finding, the code and this section. That pass scores it
1 to 10 for how sure it is that the vulnerability can be exploited here. Report it at 8 or above.
Below 8, list it under `considered, not reported` with its score and the reason, so the record of
what was examined survives and a clean review cannot read as an unexamined one.

**Not findings at this stage:**

- Denial of service, resource exhaustion, memory or CPU use. **Except** a rate limiter or quota
  that fails closed and locks real users out: that is an outage, and it goes to QA as a GAP.
  client-portal's fail-closed limiter made sign-in impossible in production (B2-1).
- A race or timing attack with no practical path.
- Missing hardening in general. A setting the contract's *Platform settings* table binds is not
  general hardening; a mismatch there is a finding (B3-10).
- Unsanitised input written to logs (log spoofing), regex injection and regex DoS.
- A missing permission check in client-side code. The server is the boundary, so review the
  server-side check.
- An attack that needs control of an environment variable or a CLI flag.
- Test files and documentation, **unless** they write to a real target (B3-3).
- An open redirect, tabnabbing or a similar low-impact web issue, **unless** it sits in a sign-in
  or magic-link flow. client-portal's sign-in redirect was a real finding and was still served by
  22 old production deployments (B3-10, B3-11).

`/security-review` also excludes outdated dependencies and secrets stored on disk. They are not
excluded here: this stage is the process that handles both (`npm audit`, `gitleaks`).

**Severity.** A reported finding that reaches auth, tenant data, secrets or code execution is
`blocking`. Anything else reported is `non-blocking`.

---

## Output

Write to `/builds/<app-name>/security-review.md`:

```
VERDICT: pass | fail
ADVISOR OUTPUT: <verbatim>
FINDINGS: <one block per finding, below>

FINDING <n> — <title>
SEVERITY: blocking | non-blocking
CATEGORY: <e.g. sql_injection, authz_bypass, data_exposure, platform_setting>
FOUND BY: <scanner name> | attempt | trace
CONFIDENCE: attempt | <8–10, from the verification pass>
LOCATION: <file:line, route, or platform setting>
ISSUE: <what is wrong>
EXPLOIT SCENARIO: <who does what, and what they get>
IMPACT: <what an attacker or a mistake gets>
FIX: <the specific change required>

CONSIDERED, NOT REPORTED: <n> — <each: location, score, why>
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

**What counts as an iteration** (B3-14). One round trip on a finding: you report it, the
Engineer changes code, you re-review. These are not iterations: a review pass with no code change,
a re-review after a contract amendment, an environmental re-scan. The cap halts when a finding is
still open after the second fix; a second iteration that closes it is done, not a halt.

**The cap counts code defects only.** Every iteration records a diagnosis line:

```
cause: code | environment | test-defect
```

`test-defect` is a fault in your own check rather than the build: a rule or probe that asserted
something the contract does not require (WH-24). Like `environment`, it is logged, does not consume
the cap, and is recorded rather than fixed silently.

An iteration whose root cause was environmental — a stale build, a scanner run against the wrong
tree, a tool that was not installed — is logged but **does not consume the cap**. This matters more
here than at QA, not less: with only two iterations, a single stale re-scan would burn half the
budget and escalate a finding that was already fixed.

Before recording a re-review as a failure, confirm the tree you scanned contains the fix.

**Inherited debt does not enter the loop.** On a `brownfield` build the contract marks bindings
`existing | changing | new`, and the survey's §9 lists guardrail debt the codebase already carried.
A finding on `existing` code is **recorded and carried forward in the deploy record, not
blocking**, unless this build touched that code. Advisors on an existing project will return a
backlog that predates this build; holding it to a 2-iteration cap would end the run before it
started, on defects nobody in it wrote. `changing` and `new` get the full review.

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
| Privileges | The standing privilege query, writes attempted as each role | Table and column grants, TRUNCATE, default ACLs | Policy logic |
| Platform settings | The platform's own API, against the contract's table | Auth and protection settings that default open | Code |
| Changed code | The third-pass trace, each finding verified | Injection, authorisation drift, exposure in what this build changed | Code this build did not touch |
| Business logic | You, manually | Tenancy, contract auth rules | Nothing — this is the backstop |

A clean automated run means the known-pattern layer is clean. It does not mean the app is safe, and
your verdict should never imply that it does.
