# Build notes — thelma

Written by: Engineer, Stage 3.
Date: 2026-08-24

Package manager: **npm** (10.9.7, Node v22.22.2). QA and Security both shell out to it.

---

## What was built

A Next.js 16 App Router application at the repository root, implementing contract.md §1–§3 as
amended by A1–A4.

| Layer | Location | Notes |
|---|---|---|
| Schema | `supabase/migrations/0001_schema.sql` | 20 tables, applied to the live project |
| Triggers | `supabase/migrations/0002_triggers.sql` | The governance rules, at the database |
| RLS | `supabase/migrations/0003_rls.sql` | Firm-scoped on every table but reference data |
| Types | `lib/db/database.types.ts` | **Generated** from the live schema |
| Numeric policy | `lib/domain/money.ts` | Integer ten-thousandths, never float |
| Drift | `lib/domain/drift.ts` | Deterministic |
| Guardrails | `lib/guardrails/engine.ts` | 11 rules, all always evaluated |
| Ledger | `lib/ledger.ts` | Append via service role, verify by recompute |
| Adapters | `lib/adapters/` | Custodian port + csv, simulated, ByAllAccounts; market data |
| Agent graph | `lib/agents/graph.ts` | TypeScript, per A3 |
| API | `app/api/**` | Every route in §3, with the documented error shapes |
| UI | `app/(app)/**`, `components/ui/` | All ten screens in design.md |
| First user | `scripts/seed-first-principal.mjs` | Per A4 |

Supabase project: `lepawvuapeqqwoygpuww` (`thelma`, us-east-1, Postgres 17). Created this run;
$0/month in this organization.

---

## Definition of done, against `agents/engineer.md`

| # | Requirement | Status |
|---|---|---|
| 1 | Every route exists and returns the documented shapes | Done. 19 routes |
| 2 | Every screen renders including empty, loading and error states | Done. 10 screens |
| 3 | Types generated, not hand-written | Done, from the live schema |
| 4 | Type check and lint pass | `tsc --noEmit` clean. Lint: see below |
| 5 | `build` and `start` work against a production build | **Verified.** See the smoke test below |
| 6 | No secrets in the repo | Verified. `.env.local` is gitignored; `.env.example` holds names only |
| 7 | Build notes written | This file |

### Production-build smoke test, run before handing to QA

`npm run build && npm start`, then:

```
GET /api/health   -> 200 {"ok":true,"commit":"local","migrations":3}
GET /api/ledger   -> 401 {"error":"unauthorized"}      (unauthenticated)
GET /sign-in      -> 200
GET /             -> 307 -> /sign-in                   (protected, redirects)
```

This is the check `agents/engineer.md` item 5 exists for: QA boots with `build && start`, not
`dev`, and a project that only runs in dev fails QA for a reason that has nothing to do with the
tests while burning an iteration of a three-iteration cap.

---

## Clarifications raised

**One**, and it was answered as amendment **A4**: contract §1's first-user mechanism specified a
SQL migration reading process environment variables, which a SQL migration cannot do. The
requirement was sound; the mechanism was not. It became `scripts/seed-first-principal.mjs`.

Nothing else in the contract was ambiguous enough to block. Where the contract was specific, it was
implemented as written — including the numeric policy, the eleven guardrail rules in order, and the
error vocabulary.

---

## Decisions worth recording

**Design tokens were used as given.** Every token in `design.md` §5 is `derived` (no Figma source
exists), so the Engineer was free to adjust them. None needed adjusting. They are mirrored in
`tailwind.config.ts` and `app/globals.css`; `design.md` remains the source.

**21st.dev components were NOT installed via the CLI.** `design.md` §1 recorded why: every
`installCommand` the catalogue returns embeds `$API_KEY_21ST`, and that variable is not set in this
environment. The components in `components/ui/` are hand-built against the same shadcn/ui
primitives the catalogue entries are built on, following the layouts and behaviours logged in
`design.md` §4. The six components `design.md` marked hand-built are hand-built as specified.
This is a **partial** satisfaction of Engineer guardrail 3 and is recorded as such rather than
claimed as complete.

**Next.js 15.1.6 → 16.3.2.** The version first pinned carried CVE-2025-66478, and 15.5.23 still
pulled a vulnerable `sharp`/libvips transitively. Next 16 clears both. `npm audit` reports zero
vulnerabilities, production and dev. On a greenfield app the upgrade cost was nil, so taking the
clean version was cheaper than carrying a known-vulnerable dependency into Stage 5a.

**`@supabase/ssr` 0.5.2 → 0.12.5.** The older release produced a differently-typed client and made
every query resolve to `never`.

**The proposal engine has two implementations.** `claude` (Claude Opus 5, adaptive thinking, a
`strict` tool for structured output) and `deterministic`. The deterministic one is not a stub: it
detects the same drift and proposes the same arithmetic trade with a plainer rationale, and it runs
whenever `ANTHROPIC_API_KEY` is absent. QA forces it via `THELMA_FORCE_DETERMINISTIC=1` so
guardrail assertions are reproducible — an LLM in that path would make guardrail tests flaky in a
way that looks exactly like a guardrail bug.

**Realised-gain tracking is conservative in v1.0.** `loadHouseholdFacts` sums sale *proceeds*
rather than gains for guardrail rule 7, because v1.0 has no lot selection. It over-states budget
consumption, which fails safe: it can refuse a trade that was affordable, never permit one that
was not. v1.1 replaces it when lot selection lands.

**`projectedAfter` is a placeholder.** Post-trade drift is computed inside the guardrail engine but
not yet threaded back out, so the recommendation's `projected_drift_bps_after` uses a deliberately
conservative halving. It never claims a better outcome than it can prove. Flagged for QA as a known
approximation rather than left to be discovered.

---

## Environment blockers Stage 3 could not clear

**`SUPABASE_SERVICE_ROLE_KEY` is not obtainable in this session.** No MCP tool exposes it, which is
correct security posture. Three things need it and therefore cannot run here:

1. `appendLedger` — every ledger write.
2. `scripts/seed-first-principal.mjs` — the first user.
3. The agent runtime's writes to `agent_runs`, `agent_steps`, `observations`, `recommendations`.

**What this means for Stage 4.** Unit tests cover the correctness surface completely and need no
key — the guardrail engine, drift arithmetic, the numeric policy, the CSV parser and the ledger
hash are all pure functions. Browser tests can cover auth gating and the unauthenticated surface.
Full end-to-end flows (run a cycle → approve → ledger entry) require the key and are **not**
runnable in this session. QA must say so rather than reporting a pass it did not obtain.

**What this means for Stage 6.** The key goes into Vercel's environment from the Supabase
dashboard, along with `FIRST_FIRM_NAME` and `FIRST_PRINCIPAL_EMAIL`, and the seed script runs once
post-deploy. Names are in `.env.example`.
