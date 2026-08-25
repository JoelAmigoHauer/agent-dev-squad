# Security review — thelma

Written by: Security, Stage 5a (pre-deploy).
Date: 2026-08-24
Package manager: **npm** 10.9.7, per `build-notes.md`.

```
VERDICT: PASS

  0 blocking findings.
  3 findings raised: 2 fixed this stage, 1 accepted as non-blocking with reasoning.
  Fix loop: 1 of 2 code iterations used.

  ONE TOOL DID NOT RUN. gitleaks is unavailable in this environment and no secret scan of git
  history was performed. That is stated here as a gap in coverage, not folded into the pass.
```

A clean automated run means the known-pattern layer is clean. It does not mean the application is
safe, and this verdict does not imply that it does.

---

## Tool resolution — evidence of execution

An absent tool and a clean tool look identical, and that failure mode fails toward a false pass.
Each tool was resolved before its result was recorded.

| Tool | Resolved? | Version / path | Ran? | Result |
|---|---|---|---|---|
| Supabase advisors | yes | hosted, project `lepawvuapeqqwoygpuww` | yes | 14 warnings → **4** after fix |
| `npm audit` | yes | npm 10.9.7, 254 deps | yes | **0 vulnerabilities**, prod and dev |
| `semgrep` | yes | 1.174.0, `/opt/semgrep-venv/bin/semgrep` | yes | **110 rules over 117 files, 0 findings, 0 errors** |
| `gitleaks` | **NO** | not installed, no container route | **NO** | **not run — see the gap below** |

`semgrep --config auto` fails on this machine with *"Cannot create auto config when metrics are
off"*. Ran with explicit registry packs instead: `p/typescript`, `p/react`, `p/nextjs`,
`p/secrets`. 68 of the 117 scanned files are application code under `app/`, `lib/`,
`components/`, `scripts/` and `middleware.ts` — recorded because a scan that silently matched
nothing but config files would also report zero.

### Coverage gap: no secret scan of git history

`gitleaks` could not run. Preflight recorded why: GitHub release downloads return 403 through the
agent proxy, and the supported `ghcr.io/gitleaks/gitleaks` container route needs Docker, whose
daemon is absent. Both are in `/ERRORS.md`.

**What this means:** nothing has scanned the git *history* for committed credentials. A key
committed and later removed is still published the moment the repository is pushed.

**Partial substitutes actually run**, recorded so the gap is bounded rather than open-ended:

- `semgrep p/secrets` over the working tree — 0 findings.
- Explicit greps for assigned literals of `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`,
  `BAA_API_KEY` — none; all are `process.env` references.
- Explicit greps for JWT-shaped (`eyJ…`) and Supabase (`sb_secret_…`, `sb_publishable_…`) literals
  in tracked files — none.
- `git ls-files --error-unmatch .env.local` — not tracked. `.gitignore:10` (`.env.*`) covers it.

Those cover the working tree. They do **not** cover history. Stage 5b or the first CI run on a
machine with gitleaks must close this.

---

## Supabase advisors — verbatim

### Before the fix: 14 warnings

```
function_search_path_mutable                    WARN  public.recommendation_frozen
function_search_path_mutable                    WARN  public.decision_by_advisor_only
function_search_path_mutable                    WARN  public.ledger_append_only
function_search_path_mutable                    WARN  public.ledger_hash
function_search_path_mutable                    WARN  public.mandate_immutable
anon_security_definer_function_executable       WARN  public.can_write()
anon_security_definer_function_executable       WARN  public.current_advisor_role()
anon_security_definer_function_executable       WARN  public.current_firm_id()
anon_security_definer_function_executable       WARN  public.is_principal()
authenticated_security_definer_function_executable  WARN  public.can_write()
authenticated_security_definer_function_executable  WARN  public.current_advisor_role()
authenticated_security_definer_function_executable  WARN  public.current_firm_id()
authenticated_security_definer_function_executable  WARN  public.is_principal()
```

(14th is the fourth `authenticated_*` row; all four are listed above.)

### After migration `0005_security_hardening.sql`: 4 warnings

```
authenticated_security_definer_function_executable  WARN  public.can_write()
authenticated_security_definer_function_executable  WARN  public.current_advisor_role()
authenticated_security_definer_function_executable  WARN  public.current_firm_id()
authenticated_security_definer_function_executable  WARN  public.is_principal()
```

**No advisor reports a missing RLS policy, an exposed view, or a permissive policy.** That is the
class that would have been blocking: a table without RLS in a multi-tenant app is a data breach
with a timestamp on it.

---

## Findings

```
FINDING 1 — five trigger functions had a role-mutable search_path
SEVERITY: non-blocking
LOCATION: supabase/migrations/0002_triggers.sql — ledger_append_only, ledger_hash,
          mandate_immutable, recommendation_frozen, decision_by_advisor_only
ISSUE:    None of the five pinned search_path. They resolve unqualified object names against
          whatever schemas are in scope for the caller.
IMPACT:   These fire during writes performed by the service role. An attacker able to create a
          schema and place it ahead on the path could shadow an object one of them references —
          including the ledger hash function, which is the thing the entire audit claim rests on.
          Requires schema-create rights, so it is a hardening gap rather than a live hole.
FIX:      alter function ... set search_path = public, on all five.
STATUS:   FIXED. Migration 0005 applied. Advisor no longer reports it.
```

Worth noting the four RLS helper functions already pinned `search_path` when they were written.
The trigger functions did not, and nothing in the review process would have caught the
inconsistency without the advisor — which is precisely the argument for running it.

```
FINDING 2 — four SECURITY DEFINER helpers were executable by `anon`
SEVERITY: non-blocking
LOCATION: supabase/migrations/0003_rls.sql — current_firm_id, current_advisor_role,
          is_principal, can_write
ISSUE:    PostgREST exposes every function in the public schema at /rest/v1/rpc/<name>. Postgres
          grants EXECUTE to PUBLIC by default, so an unauthenticated caller could invoke all four.
IMPACT:   No data disclosure — each reads auth.uid(), which is null for anon, so each returns
          null. But a SECURITY DEFINER function reachable with no session is exposed surface with
          no reason to exist, and this is the exact shape of build 1's finding: an over-broad
          grant written during Stage 3 and caught only by the advisor.
FIX:      revoke execute ... from public, anon; grant execute ... to authenticated.
STATUS:   FIXED. Migration 0005 applied. All four anon warnings cleared.
```

```
FINDING 3 — path params reached the database unvalidated
SEVERITY: non-blocking
LOCATION: 11 routes under app/api/**/[id]/
ISSUE:    `:id` was passed straight into a Supabase filter. Supabase parameterises the value so
          there is no injection, but a non-UUID id makes Postgres raise, which the handler turns
          into 500 {"error":"internal","ref":...}.
IMPACT:   A caller learns their input reached the data layer, and real 500s get buried in noise
          from malformed requests. Low, but it is free to close.
FIX:      Reject a non-UUID id as 404 before any query. A malformed id is simply not found.
STATUS:   FIXED. `isUuid` in lib/api/guards.ts, applied to all 11 routes.
```

```
FINDING 4 — four SECURITY DEFINER helpers remain executable by `authenticated`
SEVERITY: non-blocking — ACCEPTED, not fixed
LOCATION: current_firm_id, current_advisor_role, is_principal, can_write
ISSUE:    Advisor lint 0029. These stay callable at /rest/v1/rpc/<name> by any signed-in advisor.
IMPACT:   None that this review can identify. Each function reads auth.uid() and returns a fact
          about the caller themselves — their own firm id, their own role, whether they may
          write. An advisor can already read all three from their own advisor_profiles row under
          the existing RLS policy. There is no cross-tenant path and no escalation: the functions
          take no arguments, so a caller cannot ask about anyone else.
WHY NOT FIXED: `authenticated` must keep EXECUTE. Every RLS policy on every firm-scoped table
          calls these, and Postgres evaluates policy expressions as the querying role. Revoking
          would break row-level security across the whole schema — trading a lint with no
          identified impact for a real outage.
RECOMMENDED, POST-PILOT: move the four helpers into a `private` schema that PostgREST does not
          expose, grant USAGE on that schema to `authenticated`, and repoint every policy. That
          closes the lint properly. It touches 20+ policies and cannot be functionally verified
          in this environment without an authenticated session, so doing it now would mean
          shipping an unverified change to the authorisation layer of a financial system. That
          trade is not worth making today. Recorded for 5b or the first hardening pass.
```

Severity was set deliberately. Inflating everything to blocking makes the distinction useless and
guarantees the output gets ignored.

---

## Manual checks — what no scanner can see

Every scanner above is pattern-matching, and none of them knows what `contract.md` §1 says about
who may do what. Business-logic tenancy is invisible to all three and is the thing most likely to
actually hurt.

### Auth

| Check | Result |
|---|---|
| Enforced server-side, not by client redirect | **Pass.** Every route calls `requireSession` / `requireWriter` / `requirePrincipal` before touching data. `/api/health` is the sole exception and is intentional |
| Every tenant-data route checks identity, not merely a session | **Pass.** Identity comes from `getAdvisorSession()`, and RLS re-scopes every query independently |
| No route trusts a caller-supplied `firm_id` | **Pass, verified by grep.** `firm_id` is written from `session.profile.firm_id` in all 5 places it is set; no route reads it from a request body |
| Role separation matches the contract | **Pass by construction, UNVERIFIED at runtime.** `readonly` is refused writes, `principal` gates invites and shadow mode. Cannot be exercised without a service role key — QA's three role tests are written and skipped |
| Cross-tenant reads refused | **Enforced in two independent layers** — RLS on all 20 tables, plus 404-not-403 in the routes. **Not exercised at runtime**, same reason |
| 404 rather than 403 for another firm's resource | **Pass by construction.** A 403 confirms the resource exists, which is itself the leak |

### Secrets

| Check | Result |
|---|---|
| No secrets in the repo | **Pass** for the working tree. History unscanned — see the gap above |
| Env vars referenced, never inlined | **Pass.** `.env.example` carries names only, no values |
| Service-role key never reaches the browser | **Pass, verified.** `getServiceClient` appears only in server modules; no file importing it carries `'use client'` |
| `NEXT_PUBLIC_*` genuinely safe to expose | **Pass.** Only the project URL and the publishable key, both designed for browser exposure and both governed by RLS |
| Secrets absent from error messages | **Pass.** 500s return `{error:'internal', ref}`; the message goes to the server log only |
| Vendor credentials out of tenant-readable tables | **Pass.** `aggregator_connections` holds `external_id`, never a secret; the design note records that `readonly` is a compliance seat that must never read a custodian credential |

### Input validation

Every mutating route validates at the server boundary, checked route by route:

| Route | Method | Validation |
|---|---|---|
| `/api/advisors/invite` | POST | zod |
| `/api/custodian/import` | POST | multipart + 20MB cap + parser quarantine |
| `/api/custodian/sync` | POST | zod |
| `/api/firm/settings` | PATCH | zod |
| `/api/households/:id/mandate/draft` | PUT | zod |
| `/api/households/:id/mandate/publish` | POST | empty body; UUID param; publish-time validation |
| `/api/households/:id/runs` | POST | empty body; UUID param |
| `/api/recommendations/:id/approve` | POST | zod |
| `/api/recommendations/:id/modify` | POST | zod + **guardrail re-evaluation** |
| `/api/recommendations/:id/reject` | POST | zod, reason mandatory |

Validation matches the schema rather than deferring to it: allocation sums, band ordering and
autonomy bounds are all refused at the API *and* by database constraints. The database is the
backstop, not the first line.

The modify route deserves its own line. An advisor's edited legs go through **the same guardrail
engine, on the same code path** as the agent's original proposal. An advisor's modification is not
privileged over the mandate — which is the property that makes "human-on-the-hook" mean supervision
rather than override.

### File upload

Type is inferred by parsing, not trusted from the client. Size capped at 20MB. Storage keys are
not derived from user input — nothing is written to object storage at all. Unparseable rows are
quarantined and reported, never silently dropped.

### Third-party integrations

| Integration | Status |
|---|---|
| ByAllAccounts | Adapter written, **never executed** — no credential exists. Reads `BAA_API_KEY` from env, bounded by a 30s `AbortSignal.timeout` so a hung vendor cannot hold a function to its 300s ceiling. No PII leaves the system: the request sends only a firm id and a household id |
| Anthropic | Key from env. Sends holdings, symbols and mandate parameters — no client names, no account numbers, no SSNs. The prompt is assembled in `renderPrompt` and carries account **ids**, not account holders |
| Webhooks | **None.** No integration in v1.0 receives an inbound webhook, so there is no signature verification to check. Recorded so a later reviewer does not read its absence as an omission |

**One point worth stating plainly for the brief's "no training on client data without explicit
controls" requirement:** the Anthropic API does not train on API inputs by default, and the data
sent is portfolio state rather than client identity. If a firm requires zero-retention, that is a
commercial configuration on the Anthropic account, not a code change — recorded here so the
question is not rediscovered during a pilot.

---

## Fix-loop accounting

Cap is 2, counting code defects only.

| Iteration | Cause | Consumed cap? | What happened |
|---|---|---|---|
| 1 | **code** | **Yes — 1 of 2** | Findings 1, 2 and 3 fixed together; migration 0005 applied; **full re-review run**, not just the raised findings: advisors re-run (14 → 4), 80 unit assertions re-run green, typecheck clean, production build succeeds, 17 browser assertions re-run green |

Finding 4 consumed no iteration — it was accepted, not kicked back.

---

## What Stage 5b must do

5a runs pre-deploy and cannot see the deployed surface. 5b inherits:

1. **Re-run the advisors against the deployed project after the seed script runs.** The seed
   creates the first `auth.users` row and the first firm; advisors have never seen the schema with
   real rows in it.
2. **Run gitleaks** against the repository including history, on a machine that has it. This is the
   one coverage gap in the automated layer and it stays open until then.
3. **Verify the service-role key is set in Vercel and absent from the client bundle.** Grep the
   built `.next/static` output for it — the check is cheap and the failure is catastrophic.
4. **Confirm `shadow_mode` is `true` on the seeded firm.** It defaults true at the database, and
   the seed sets it explicitly, but it is the single most consequential flag in the product and
   deserves an eyes-on check rather than an assumption.
5. **Re-run QA's three skipped role/tenancy tests** once a session can be minted. Until then,
   cross-tenant isolation is enforced in two layers and demonstrated in neither.
