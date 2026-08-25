# Deploy record — thelma

Written by: DevOps, Stage 6.
Date: 2026-08-24

```
STATUS: HALTED BEFORE ATTEMPT 1 — missing a required environment variable.
ATTEMPTS: 0 of 2 used. Nothing was deployed.
```

No deploy attempt was made, so no attempt was consumed. This is deliberate: `agents/devops.md`
states that *"a deploy that succeeds with a missing variable and fails at first user request is a
failed deploy — check before promoting, not after"*, and the cap exists so that a second attempt is
a fix for a diagnosed cause rather than the same deploy run again. Spending attempt 1 on a deploy
already known to fail its own smoke test would have burned half the budget to learn nothing.

---

## Preconditions — all met

| Gate | Status |
|---|---|
| Stage 4 QA green | **Yes.** 113 assertions, 0 failing, 3 documented skips |
| Stage 5a Security pass | **Yes.** 0 blocking findings |
| Blocking security findings outstanding | **None** |
| Type check | Clean |
| Production build | Succeeds — 24 routes compiled |
| `build` + `start` boots and serves | Verified |

Nothing in QA or Security blocks this deploy. The blocker is environmental.

---

## The blocker

**`SUPABASE_SERVICE_ROLE_KEY` cannot be obtained in this session.** No MCP tool exposes it, which
is correct security posture — a tool that hands out service-role keys would itself be the finding.

It is not optional for this application. Three paths need it, and they are the three that make
Thelma what it is rather than a dashboard:

| Path | What breaks without the key |
|---|---|
| `appendLedger` | **Every ledger write.** `decision_ledger` deliberately has no INSERT policy, so nothing but the service role can append. Publishing a mandate, approving, rejecting, modifying, importing, exporting — all 500 |
| The monitoring cycle | `POST /api/households/:id/runs` writes `agent_runs`, `agent_steps`, `observations` and `recommendations` through the service role. No cycle can run |
| `scripts/seed-first-principal.mjs` | The first principal is never created, so **nobody can sign in at all** |

The third one settles it on its own. A deployment nobody can sign into is not a deployment.

### Why a preview deploy is not available as a compromise

Vercel assigns a project's **first** deployment to production regardless of flags. There is no
`thelma` project in the team today (17 projects, none named thelma), so deploy one is production
by construction — with no rollback target, no seeded user, and every write path returning 500.

That is the exact shape `agents/devops.md` calls a failed deploy, and doing it to a system that
will hold custodial position data is not a trade worth making for the sake of a URL.

---

## What is ready, so this is a five-minute job once the key exists

| Item | State |
|---|---|
| Supabase project | **Created and migrated.** `lepawvuapeqqwoygpuww` (`thelma`, us-east-1, Postgres 17) |
| Migrations | **5 applied.** `0001_schema`, `0002_triggers`, `0003_rls`, `0004_ledger_fk_restrict`, `0005_security_hardening` |
| Migration reversible | **No.** See the rollback section |
| Vercel team | `team_TYU1N9pGXUueXJ9JuNumb1MJ`, plan **Pro** |
| Vercel project | Not created — deliberately, see above |
| Repo | `JoelAmigoHauer/agent-dev-squad`, branch `claude/thelma-portfolio-agent-ba057f` |

### Environment variables required — names only, never values

| Variable | Scope | Source | Have it? |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client + server | `https://lepawvuapeqqwoygpuww.supabase.co` | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client + server | publishable key, safe to expose, governed by RLS | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | Supabase dashboard → Project Settings → API | **NO — the blocker** |
| `FIRST_FIRM_NAME` | server only | Joel's choice | No — needs a decision |
| `FIRST_PRINCIPAL_EMAIL` | server only | Joel's choice | No — needs a decision |
| `THELMA_AGENT_IDENTITY` | server only | `thelma/monitor@1.0.0` | Yes, defaulted |
| `ANTHROPIC_API_KEY` | server only | optional — absent means the deterministic proposal engine runs | Optional |
| `THELMA_MODEL` | server only | `claude-opus-5` | Yes, defaulted |
| `BAA_API_KEY`, `BAA_BASE_URL` | server only | not needed in v1.0 — no ByAllAccounts credential exists | Not applicable |

**Audited one by one rather than trusted by prefix.** Only two variables are client-exposed: the
project URL and the publishable key. Both are designed for browser exposure and both are useless
without a session because RLS governs every table. **`SUPABASE_SERVICE_ROLE_KEY` must never be
given a `NEXT_PUBLIC_` prefix** — that single mistake would hand every visitor unrestricted read
and write across every firm's data.

---

## Rollback path — established before promoting, as required

**Deploy one has no rollback target.** There is no previous production deployment to promote back
to. This is the documented special case, and it is why the production smoke test must run before
the URL is shared with anyone.

**The database rollback is the harder half, and it needs stating plainly.**

```
MIGRATIONS APPLIED:   0001_schema, 0002_triggers, 0003_rls,
                      0004_ledger_fk_restrict, 0005_security_hardening
MIGRATION REVERSIBLE: NO
```

A code rollback against this schema is not a rollback, it is a second incident. Specifically:

- `decision_ledger` is append-only and hash-chained. Rolling the schema back does not un-write
  entries, and dropping the table destroys the audit trail — which on this product is the asset.
- `0004` changed a foreign key to `ON DELETE RESTRICT`. Reverting it re-opens the contradiction QA
  found in GAP 2.
- `0005` revoked grants. Reverting re-exposes the SECURITY DEFINER helpers to `anon`.

**Practical rollback plan:** roll back *code* by promoting a previous Vercel deployment; leave the
schema forward. All five migrations are additive or restrictive, so an older application build runs
against them without error. Do not attempt a schema rollback without a decision from Joel — that is
an escalation, not a runbook step.

---

## Not yet done, because the deploy did not happen

- [ ] Vercel project created and linked
- [ ] Environment variables set
- [ ] CI confirmed on the deployed build
- [ ] Smoke test against the contract's core flows
- [ ] Production verification: app loads, auth works, one write path succeeds end to end
- [ ] **Stage 5b fired** — hosted-only security checks. Stage 6 is not complete until it passes
- [ ] Scheduled scan set entry

## Non-blocking security findings to carry forward when this does deploy

1. Four SECURITY DEFINER RLS helpers remain executable by `authenticated`. Accepted with reasoning
   in `security-review.md` FINDING 4; the proper close is a `private` schema, post-pilot.
2. **gitleaks never ran.** Git history has not been scanned for committed credentials. This is the
   one open gap in the automated security layer and 5b must close it.
3. `projected_drift_bps_after` is a conservative approximation, not a computed post-trade drift.
4. QA's three role-separation and cross-tenant tests are written and skipped. They need the same
   service-role key, so supplying it closes this and the blocker together.
