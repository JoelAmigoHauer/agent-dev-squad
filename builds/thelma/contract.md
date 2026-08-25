# Contract — thelma

Written by: Architect, Stage 1. Binding on Stages 2–6.
Date: 2026-08-24

All five sections are mandatory. Amendments are appended at the bottom, dated, by the Architect
only.

---

## 1. Written spec

```
FIDELITY:    production
BUILD CLASS: C — fires escalation triggers 4 and 5 (see §5). Named users other than Joel
             (RIA advisors), a stated SOC 2 path, and a shadow-mode pilot with real firms.
             No time target. The win is flagging now, before Design and Engineering effort is sunk.
```

### What this contract covers, and what it does not

The brief's §6 names the first deliverable itself: *"Start with a thin vertical slice: mandate
config → data ingestion from one custodian → drift detection → explained recommendation → review
workflow → ledger entry."* This contract binds that slice as **v1.0** and is written so the rest of
the MVP extends it without touching the control plane.

**Contracted as v1.0 — built by Stage 3:**

| Brief item | Status in v1.0 |
|---|---|
| Mandate configuration UI, structured, `<10 min` | Full |
| Continuous monitoring loop | Full for drift, risk breach, cash events. Deterministic |
| Reasoning + ranked, explained recommendations | Full |
| Review-and-release workflow | Full for approve / reject / modify. **Release stops at `approved`** — no order leaves the system in v1.0 |
| Full decision ledger, exportable | Full, hash-chained, with a verification endpoint |
| Multi-agent internal architecture under a governance layer | Full — monitor, risk/compliance, tax, proposal, guardrail |
| Core integration 1 — custodian | **Adapter seam + `csv` and `simulated` implementations.** See §4 |
| Market data feed | Snapshot prices via a polled adapter. See §4 and the escalation |
| Advisor dashboard | Full |
| Shadow mode / simulation mode | Full, and **on by default** |

**Deliberately deferred, with the seam that carries each:**

| Deferred | Seam it extends |
|---|---|
| Schwab / Fidelity / Pershing live adapters + order routing | `CustodianAdapter` port (§3) |
| Second custodian | same port |
| Orion / Addepar / Black Diamond | `AccountingAdapter`, same shape, not built in v1.0 |
| Salesforce FSC / Redtail / Wealthbox | `CrmAdapter`, same shape, not built in v1.0 |
| Tax-lot harvesting with wash-sale detection | `tax_lots` and `transactions` are in the v1.0 schema and populated at ingest, specifically so this needs no migration |
| Client-ready narrative generation | reads `recommendations.rationale`, additive |
| Slack / email escalation | reads `observations`, additive |

Nothing in the deferred column is out of scope for the product. Each is out of scope for **this
contract**, and each has a named place to land.

### What the model decides, and what it must never decide

The single most important line in this contract. Probabilistic reasoning is bounded by
deterministic guardrails, per the brief's non-negotiable principle 1.

| Concern | Decided by | Never by |
|---|---|---|
| Is the portfolio outside its allocation bands? | Deterministic SQL + arithmetic over `positions` and `mandate_allocations` | A model |
| Is a security prohibited? Is a concentration cap breached? | Deterministic evaluation of `mandate_constraints` | A model |
| Does a proposed trade violate the mandate? | The **guardrail engine** — deterministic, runs after the model, before anything is persisted as actionable | A model |
| May this action auto-execute? | `mandate_autonomy.tier` + bounds, checked in code | A model |
| Which of the legal proposals is best, and why | The proposal agent (LLM) | — |
| The human-readable rationale | The proposal agent (LLM) | — |

A model output that fails the guardrail engine is **never** shown to the advisor as a
recommendation. It is written to `agent_steps` with the breach recorded, so the rejection is itself
auditable, and the run continues.

### Screens

| # | Screen | Route | What it is |
|---|---|---|---|
| 1 | Sign in | `/sign-in` | Supabase email/password + magic link. No public sign-up |
| 2 | Firm dashboard | `/` | Book-level: households, open recommendations, risk status, recent agent activity, shadow-mode banner |
| 3 | Household list | `/households` | Sortable, with drift and open-recommendation counts |
| 4 | Household detail | `/households/:id` | Holdings, target vs actual allocation, drift bars, mandate summary, open recommendations, run history |
| 5 | Mandate editor | `/households/:id/mandate` | The `<10 min` config. Six steps: objective & risk → allocation bands → tax → liquidity → rebalancing → autonomy. Saves a draft at each step |
| 6 | Mandate versions | `/households/:id/mandate/versions` | Every published version, read-only, with a diff against the previous |
| 7 | Recommendation detail | `/recommendations/:id` | Rationale, legs, projected drift/tax impact, guardrail result, data provenance, approve / reject / modify |
| 8 | Decision ledger | `/ledger` | Filterable by household, actor, event type, date. CSV export. Chain-verify button |
| 9 | Agent run trace | `/runs/:id` | Every step in sequence: which agent, tool calls, inputs, outputs, model, latency |
| 10 | Settings | `/settings` | Custodian connections, import, shadow-mode toggle, firm autonomy ceiling, advisor list |

### User flows, start to finish, with failure paths

**F1 — Configure a mandate.** Advisor opens household → *Configure mandate* → six-step editor. Each
step `PUT`s a draft; a draft is resumable and never enforced. *Publish* validates server-side, and
on success creates version N+1 as `published`, marks N `superseded`, and appends a ledger entry.
*Failure:* allocation targets not summing to 10000bps → `422`, the offending field flagged inline,
no version created. *Failure:* an `auto_execute` tier with no bounds → `422`, refused by the
database as well as the API. *Failure:* a second advisor published while this draft was open →
`409` with the version that won; the editor reloads and the advisor re-applies.

**F2 — Ingest holdings.** Advisor opens Settings → *Import holdings* → uploads a custodian extract,
or picks the simulated book. Parser resolves securities by symbol/CUSIP, upserts accounts,
positions, tax lots and transactions, stamps `as_of`, appends a ledger entry naming the file and
its row count. *Failure:* an unknown symbol → the row is quarantined, not silently dropped; the
response lists quarantined rows and the import completes for the rest. *Failure:* a stale extract
whose `as_of` is older than the current positions → `409`, nothing written.

**F3 — Monitoring cycle.** Fires on schedule, or from *Run monitoring cycle*. Creates an
`agent_runs` row. Loads the **published** mandate — never a draft. Deterministic pass computes
allocation drift, risk breaches, cash events, writes `observations`. If nothing is material, the
run completes with zero recommendations and that is a success, not an empty result. Otherwise the
proposal agent produces candidates; the guardrail engine evaluates each against the mandate; those
that pass are persisted as ranked `recommendations` with rationale, projected impact and
provenance. *Failure:* no published mandate → run fails with `no_published_mandate`, visible on the
household. *Failure:* prices staler than the mandate's tolerance → run completes but every
recommendation is marked `stale_data` and cannot be approved.

**F4 — Review and release.** Advisor opens a recommendation, reads rationale, legs, projected drift
and tax impact, and the provenance block. *Approve* → status `approved`, ledger entry with the
advisor's identity. *Reject* → status `rejected`, reason mandatory, ledger entry. *Modify* → the
advisor edits leg quantities; the guardrail engine **re-runs** on the modified set. *Failure:* the
modified set breaches the mandate → `422` naming the breached rule; nothing is stored. *Failure:* a
second advisor already decided → `409`. *Failure:* the recommendation has expired → `409`, and it
must be regenerated from a fresh run rather than approved late.

**F5 — Audit.** Advisor opens the ledger, filters, exports CSV. The export is itself a ledger
event. *Chain-verify* recomputes every hash for the firm and reports the first divergence, or
confirms the chain intact.

**F6 — Shadow mode.** On by default per firm. While on, every execution path returns `423 Locked`
and says so. Turning it off is a `principal`-only action and writes a ledger entry. In v1.0 nothing
downstream of `approved` exists, so shadow mode's real job is to be **provably** wired before it
ever guards a live order.

### Core entities and how they relate

```
firms ─┬─ advisor_profiles (= auth.users)
       └─ households ─┬─ accounts ─┬─ positions ──── securities ─── security_prices
                      │            ├─ tax_lots ───── securities
                      │            └─ transactions ─ securities
                      ├─ mandates (versioned; ≤1 published) ─┬─ mandate_allocations
                      │                                      ├─ mandate_constraints
                      │                                      └─ mandate_autonomy
                      └─ agent_runs ─┬─ agent_steps
                                     ├─ observations
                                     └─ recommendations ─ recommendation_legs
       └─ decision_ledger  (append-only, hash-chained per firm)
```

A `recommendation` carries `mandate_id`, not `household_id` alone. It records the mandate **version
it was reasoned against**, so a recommendation stays explainable after the mandate changes. Without
that column the audit trail claims a recommendation obeyed rules that did not yet exist.

### Auth requirements

Supabase Auth. Every table except `securities` and `security_prices` carries `firm_id`, and RLS is
firm-scoped on all of them. There is no cross-firm read on any path.

| Role | Reads | Writes |
|---|---|---|
| `principal` | everything in the firm | everything, plus advisor invites, role changes, shadow-mode toggle |
| `advisor` | everything in the firm | mandates, imports, recommendation decisions, runs |
| `readonly` | everything in the firm | nothing. Compliance and examiner seats |

The agent is **not** an advisor. It authenticates as a service identity, writes ledger entries with
`actor_type = 'agent'` and an `agent_identity` string (`thelma/monitor@1.0.0`), and can never
approve a recommendation — no code path exists that sets `decided_by` to a non-advisor. This is the
brief's "strong identity and permissioning for the agent itself" as a schema fact rather than a
policy.

### First user

**Mechanism: a seeded firm principal, created by a migration against the deployed database.**

`supabase/migrations/*_seed_first_principal.sql` runs at deploy, reads `FIRST_PRINCIPAL_EMAIL` and
`FIRST_FIRM_NAME` from the environment, creates the `firms` row and an `auth.users` row with no
password, and inserts the matching `advisor_profiles` row with `role = 'principal'`. The advisor
sets a password via the standard password-reset flow on first sign-in.

Every subsequent advisor exists by invite from a `principal` — `POST /api/advisors/invite`. There
is no public sign-up, and there must not be: a public sign-up route on a system holding custodial
positions is a finding at the first examination.

### Flow bindings

Every flow crossing the UI/API boundary. Each row reconciles with a screen above and a route in §3.

| Flow | Screen | Control | Calls | Post-condition |
|---|---|---|---|---|
| Load mandate editor | Mandate editor | page load | `GET /api/households/:id/mandate` | published version and any open draft render; draft wins where both exist |
| Save mandate draft | Mandate editor | "Save draft" (per step) | `PUT /api/households/:id/mandate/draft` | draft persists, `status` stays `draft`, no version created, editor resumable after reload |
| Publish mandate | Mandate editor | "Publish mandate" | `POST /api/households/:id/mandate/publish` | version N+1 `published`, N `superseded`, ledger entry appended, editor reloads read-only at N+1 |
| Reject bad allocation | Mandate editor | "Publish mandate" | `POST /api/households/:id/mandate/publish` | `422`, band sum shown inline, **no** new version, ledger unchanged |
| Reject unbounded autonomy | Mandate editor | "Publish mandate" | `POST /api/households/:id/mandate/publish` | `422` naming the action, **no** new version |
| View version history | Mandate versions | version row | `GET /api/households/:id/mandate/versions` | prior versions render read-only with a diff against the previous |
| Import holdings | Settings | "Import holdings" | `POST /api/custodian/import` | accounts/positions/tax lots/transactions upserted, `as_of` stamped, quarantined rows listed, ledger entry appended |
| Reject stale import | Settings | "Import holdings" | `POST /api/custodian/import` | `409`, nothing written, existing positions unchanged |
| Run monitoring cycle | Household detail | "Run monitoring cycle" | `POST /api/households/:id/runs` | `agent_runs` row created, drift card and open-recommendation count refresh, run appears in history |
| Refuse run without mandate | Household detail | "Run monitoring cycle" | `POST /api/households/:id/runs` | `409 no_published_mandate`, no run row, message on the household |
| View drift | Household detail | page load / "Refresh" | `GET /api/households/:id/drift` | per-class bands render with actual vs target and a `breached` flag; recomputed, never cached |
| List open recommendations | Household detail | page load | `GET /api/recommendations?householdId=&status=` | pending recommendations render in `rank` order; empty state is a success, not an error |
| Open recommendation | Household detail | recommendation row | `GET /api/recommendations/:id` | rationale, legs, projected impact, guardrail result and provenance all render |
| Approve recommendation | Recommendation detail | "Approve" | `POST /api/recommendations/:id/approve` | status `approved`, `decided_by` set, ledger entry appended, badge changes |
| Refuse double decision | Recommendation detail | "Approve" | `POST /api/recommendations/:id/approve` | `409` on an already-decided recommendation, first decision unchanged |
| Refuse expired approval | Recommendation detail | "Approve" | `POST /api/recommendations/:id/approve` | `409 expired`, status stays `pending`, no ledger entry |
| Reject recommendation | Recommendation detail | "Reject" | `POST /api/recommendations/:id/reject` | reason required, status `rejected`, ledger entry appended |
| Modify and approve | Recommendation detail | "Modify & approve" | `POST /api/recommendations/:id/modify` | guardrails re-run, status `modified_approved`, new legs stored, ledger entry carries both leg sets |
| Refuse breaching modification | Recommendation detail | "Modify & approve" | `POST /api/recommendations/:id/modify` | `422` naming the breached rule, legs unchanged, status stays `pending` |
| View run trace | Agent run trace | run row | `GET /api/runs/:id` | steps render in `seq` order with agent, tool calls, inputs, outputs, latency |
| Filter ledger | Decision ledger | filter controls | `GET /api/ledger` | rows narrow to the filter, `seq` order preserved |
| Export ledger | Decision ledger | "Export CSV" | `GET /api/ledger/export` | CSV downloads, **and the export appends its own ledger entry** |
| Verify chain | Decision ledger | "Verify chain" | `GET /api/ledger/verify` | reports `intact` with row count, or the first divergent `seq` |
| Toggle shadow mode | Settings | "Shadow mode" | `PATCH /api/firm/settings` | flag flips, banner appears/clears firm-wide, ledger entry appended |
| Refuse toggle by advisor | Settings | "Shadow mode" | `PATCH /api/firm/settings` | `403` for `advisor` and `readonly`, flag unchanged |
| Invite advisor | Settings | "Invite advisor" | `POST /api/advisors/invite` | invite sent, `advisor_profiles` row created, ledger entry appended |

`GET /api/health` is the one route with no control, deliberately — it is Stage 6's deploy probe,
not a screen. Every other route in §3 is reached by a row above, and every row calls a route that
exists. That reconciliation is the check; it caught three orphaned routes on its first run.

---

## 2. Data model

Schema, not prose. Postgres 17 on Supabase.

**Numeric policy, binding on every stage.** Money is `numeric(20,4)`, quantity is `numeric(20,6)`,
percentages are integer **basis points** (`6000` = 60.00%). Never `float`, never `money`, and —
departing from this pipeline's usual integer-cents habit — never cents: per-share prices carry more
than two decimals and a $5M household compounds the rounding drift into a number an examiner will
ask about. Basis points are integers so band arithmetic is exact.

```sql
create extension if not exists pgcrypto;

-- ============================================================
-- tenancy
-- ============================================================

create table firms (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  crd_number    text,
  shadow_mode   boolean not null default true,
  created_at    timestamptz not null default now()
);
-- RLS: visible only to advisors whose advisor_profiles.firm_id matches. No cross-firm read on any
--      path. shadow_mode defaults TRUE: a firm that has never been configured cannot execute.

create type advisor_role as enum ('principal','advisor','readonly');

create table advisor_profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  firm_id       uuid not null references firms(id) on delete cascade,
  full_name     text not null,
  email         text not null,
  role          advisor_role not null default 'advisor',
  created_at    timestamptz not null default now()
);
create unique index advisor_profiles_firm_email_idx on advisor_profiles (firm_id, lower(email));
-- RLS: select within own firm. insert/update of role restricted to role='principal'.

-- ============================================================
-- book
-- ============================================================

create table households (
  id                 uuid primary key default gen_random_uuid(),
  firm_id            uuid not null references firms(id) on delete cascade,
  name               text not null,
  primary_advisor_id uuid references advisor_profiles(id) on delete set null,
  created_at         timestamptz not null default now()
);
-- RLS: firm-scoped select/insert/update for advisor and principal; readonly gets select only.

create type account_tax_treatment as enum
  ('taxable','traditional_ira','roth_ira','employer_401k','trust','other');

create table accounts (
  id                   uuid primary key default gen_random_uuid(),
  firm_id              uuid not null references firms(id) on delete cascade,
  household_id         uuid not null references households(id) on delete cascade,
  custodian            text not null,          -- 'csv' | 'simulated' | 'schwab' | 'fidelity' | 'pershing'
  custodian_account_id text not null,
  display_name         text not null,
  tax_treatment        account_tax_treatment not null,
  cash_balance         numeric(20,4) not null default 0,
  as_of                timestamptz,
  created_at           timestamptz not null default now()
);
create unique index accounts_custodian_key_idx
  on accounts (firm_id, custodian, custodian_account_id);
-- tax_treatment is not decoration: the tax agent must never propose harvesting in an IRA, and
-- that check reads this column.

create type asset_class as enum
  ('us_equity','intl_developed_equity','emerging_equity','us_bond','intl_bond',
   'real_assets','cash','other');

create table securities (
  id            uuid primary key default gen_random_uuid(),
  symbol        text not null unique,
  cusip         text unique,
  name          text not null,
  asset_class   asset_class not null,
  sector        text,
  is_etf        boolean not null default false,
  created_at    timestamptz not null default now()
);
-- RLS: global reference data. select to any authenticated advisor; insert/update service-role only.
-- No firm_id by design — two firms holding VTI must resolve to the same security row or drift
-- arithmetic differs between them.

create table security_prices (
  security_id   uuid not null references securities(id) on delete cascade,
  price_date    date not null,
  close_price   numeric(20,4) not null check (close_price > 0),
  source        text not null,
  fetched_at    timestamptz not null default now(),
  primary key (security_id, price_date)
);
-- RLS: as securities. source is recorded per row because provenance names it (§3, provenance block).

create table positions (
  id            uuid primary key default gen_random_uuid(),
  firm_id       uuid not null references firms(id) on delete cascade,
  account_id    uuid not null references accounts(id) on delete cascade,
  security_id   uuid not null references securities(id),
  quantity      numeric(20,6) not null,
  market_value  numeric(20,4) not null,
  cost_basis    numeric(20,4) not null,
  as_of         timestamptz not null,
  created_at    timestamptz not null default now()
);
create unique index positions_account_security_asof_idx
  on positions (account_id, security_id, as_of);
-- Positions are kept as dated snapshots rather than mutated in place. A recommendation must stay
-- explainable against the holdings that existed when it was made; an UPDATE would erase them.

create table tax_lots (
  id               uuid primary key default gen_random_uuid(),
  firm_id          uuid not null references firms(id) on delete cascade,
  account_id       uuid not null references accounts(id) on delete cascade,
  security_id      uuid not null references securities(id),
  custodian_lot_id text,
  open_date        date not null,
  quantity         numeric(20,6) not null check (quantity > 0),
  cost_basis       numeric(20,4) not null,
  as_of            timestamptz not null
);
create index tax_lots_lookup_idx on tax_lots (account_id, security_id, open_date);
-- Populated at ingest in v1.0 and read by nothing until v1.1. It is here now because lot-level
-- harvesting cannot be retrofitted later — the history it needs would not exist to backfill.

create type transaction_type as enum
  ('buy','sell','dividend','interest','deposit','withdrawal','fee','transfer_in','transfer_out');

create table transactions (
  id               uuid primary key default gen_random_uuid(),
  firm_id          uuid not null references firms(id) on delete cascade,
  account_id       uuid not null references accounts(id) on delete cascade,
  security_id      uuid references securities(id),
  txn_type         transaction_type not null,
  trade_date       date not null,
  settle_date      date,
  quantity         numeric(20,6),
  price            numeric(20,4),
  amount           numeric(20,4) not null,
  custodian_txn_id text,
  created_at       timestamptz not null default now()
);
create unique index transactions_custodian_idx
  on transactions (account_id, custodian_txn_id) where custodian_txn_id is not null;
create index transactions_washsale_idx on transactions (account_id, security_id, trade_date);
-- The second index exists for the 61-day wash-sale window. Same reasoning as tax_lots.

-- ============================================================
-- mandate — the machine-readable IPS. A first-class policy object.
-- ============================================================

create type mandate_status as enum ('draft','published','superseded');
create type tax_sensitivity as enum ('none','moderate','high');
create type rebalance_trigger as enum ('band','calendar','both');

create table mandates (
  id                   uuid primary key default gen_random_uuid(),
  firm_id              uuid not null references firms(id) on delete cascade,
  household_id         uuid not null references households(id) on delete cascade,
  version              integer not null check (version > 0),
  status               mandate_status not null default 'draft',

  objective            text not null,
  risk_target          integer not null check (risk_target between 1 and 10),
  max_drawdown_bps     integer check (max_drawdown_bps between 0 and 10000),

  tax_sensitivity      tax_sensitivity not null default 'moderate',
  realized_gain_budget numeric(20,4),

  min_cash_bps         integer not null default 0 check (min_cash_bps between 0 and 10000),
  liquidity_need       numeric(20,4) not null default 0,
  liquidity_by         date,

  rebalance_trigger    rebalance_trigger not null default 'band',
  drift_tolerance_bps  integer not null default 500 check (drift_tolerance_bps > 0),
  min_trade_amount     numeric(20,4) not null default 1000,
  price_staleness_hours integer not null default 24 check (price_staleness_hours > 0),

  published_at         timestamptz,
  published_by         uuid references advisor_profiles(id),
  superseded_at        timestamptz,
  created_at           timestamptz not null default now(),
  created_by           uuid not null references advisor_profiles(id)
);
create unique index mandates_household_version_idx on mandates (household_id, version);
create unique index mandates_one_published_idx
  on mandates (household_id) where status = 'published';
create unique index mandates_one_draft_idx
  on mandates (household_id) where status = 'draft';
-- Two partial unique indexes carry two rules the application must never be trusted with:
-- at most one published mandate per household, and at most one open draft.

create table mandate_allocations (
  id            uuid primary key default gen_random_uuid(),
  mandate_id    uuid not null references mandates(id) on delete cascade,
  asset_class   asset_class not null,
  target_bps    integer not null check (target_bps between 0 and 10000),
  min_bps       integer not null check (min_bps between 0 and 10000),
  max_bps       integer not null check (max_bps between 0 and 10000),
  constraint band_ordered check (min_bps <= target_bps and target_bps <= max_bps)
);
create unique index mandate_allocations_class_idx on mandate_allocations (mandate_id, asset_class);
-- sum(target_bps) = 10000 is checked at publish time in the API, not in DDL: a row-level check
-- cannot see its siblings, and a deferred constraint trigger would block the draft-by-step editor.

create type constraint_kind as enum
  ('prohibited_security','prohibited_sector','concentration_cap','hold_minimum');

create table mandate_constraints (
  id            uuid primary key default gen_random_uuid(),
  mandate_id    uuid not null references mandates(id) on delete cascade,
  kind          constraint_kind not null,
  security_id   uuid references securities(id),
  sector        text,
  limit_bps     integer check (limit_bps between 0 and 10000),
  note          text,
  constraint constraint_shape check (
    (kind = 'prohibited_security' and security_id is not null) or
    (kind = 'prohibited_sector'   and sector      is not null) or
    (kind = 'concentration_cap'   and limit_bps   is not null) or
    (kind = 'hold_minimum'        and security_id is not null and limit_bps is not null)
  )
);

create type action_type as enum
  ('rebalance_trade','tax_loss_harvest','cash_raise','cash_invest','alert_only');
create type autonomy_tier as enum ('observe','propose','auto_execute');

create table mandate_autonomy (
  id                uuid primary key default gen_random_uuid(),
  mandate_id        uuid not null references mandates(id) on delete cascade,
  action            action_type not null,
  tier              autonomy_tier not null default 'propose',
  max_trade_amount  numeric(20,4),
  max_daily_amount  numeric(20,4),
  constraint autonomy_bounded check (
    tier <> 'auto_execute'
    or (max_trade_amount is not null and max_trade_amount > 0
        and max_daily_amount is not null and max_daily_amount > 0)
  )
);
create unique index mandate_autonomy_action_idx on mandate_autonomy (mandate_id, action);
-- An unbounded auto_execute tier cannot be stored. The brief's graduated-autonomy principle is a
-- database constraint here rather than a convention, because a convention is what fails quietly.

-- ============================================================
-- agent runs, observations, recommendations
-- ============================================================

create type run_status as enum ('running','complete','failed');

create table agent_runs (
  id            uuid primary key default gen_random_uuid(),
  firm_id       uuid not null references firms(id) on delete cascade,
  household_id  uuid not null references households(id) on delete cascade,
  mandate_id    uuid not null references mandates(id),
  status        run_status not null default 'running',
  trigger       text not null check (trigger in ('manual','scheduled','event')),
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  error         text
);
create index agent_runs_household_idx on agent_runs (household_id, started_at desc);

create table agent_steps (
  id            uuid primary key default gen_random_uuid(),
  run_id        uuid not null references agent_runs(id) on delete cascade,
  seq           integer not null,
  agent         text not null check (agent in ('monitor','risk','tax','proposal','guardrail')),
  step_type     text not null check (step_type in ('tool_call','reasoning','decision','rejection')),
  input         jsonb,
  output        jsonb,
  model         text,
  tokens_in     integer,
  tokens_out    integer,
  latency_ms    integer,
  started_at    timestamptz not null default now()
);
create unique index agent_steps_seq_idx on agent_steps (run_id, seq);
-- step_type 'rejection' is how a guardrail refusal survives. A proposal the engine killed is
-- never shown to the advisor, but it is not discarded — the refusal is part of the audit.

create type observation_kind as enum
  ('allocation_drift','risk_breach','cash_event','tax_opportunity','constraint_violation');
create type severity as enum ('info','warning','critical');

create table observations (
  id            uuid primary key default gen_random_uuid(),
  firm_id       uuid not null references firms(id) on delete cascade,
  run_id        uuid not null references agent_runs(id) on delete cascade,
  household_id  uuid not null references households(id) on delete cascade,
  kind          observation_kind not null,
  severity      severity not null,
  asset_class   asset_class,
  security_id   uuid references securities(id),
  detail        jsonb not null,
  detected_at   timestamptz not null default now()
);
-- detail for allocation_drift: { targetBps, actualBps, driftBps, toleranceBps, marketValue }
-- Produced by deterministic code only. See §1, "What the model decides".

create type recommendation_status as enum
  ('pending','approved','rejected','modified_approved','expired','auto_executed');

create table recommendations (
  id                          uuid primary key default gen_random_uuid(),
  firm_id                     uuid not null references firms(id) on delete cascade,
  run_id                      uuid not null references agent_runs(id) on delete cascade,
  household_id                uuid not null references households(id) on delete cascade,
  mandate_id                  uuid not null references mandates(id),
  action                      action_type not null,
  rank                        integer not null check (rank > 0),
  status                      recommendation_status not null default 'pending',
  rationale                   text not null,
  projected_drift_bps_before  integer not null,
  projected_drift_bps_after   integer not null,
  projected_realized_gain     numeric(20,4) not null default 0,
  projected_tax_cost          numeric(20,4) not null default 0,
  stale_data                  boolean not null default false,
  guardrail_result            jsonb not null,
  provenance                  jsonb not null,
  expires_at                  timestamptz not null,
  decided_at                  timestamptz,
  decided_by                  uuid references advisor_profiles(id),
  decision_note               text,
  created_at                  timestamptz not null default now()
);
create unique index recommendations_run_rank_idx on recommendations (run_id, rank);
create index recommendations_open_idx
  on recommendations (household_id, status) where status = 'pending';
-- mandate_id records the version reasoned against, not merely the household. Without it a
-- recommendation read six months later appears to have obeyed rules that did not yet exist.
-- RLS: firm-scoped. Only status, decided_at, decided_by, decision_note are updatable —
--      rationale, guardrail_result and provenance are frozen at insert by trg_recommendation_frozen.

create table recommendation_legs (
  id                uuid primary key default gen_random_uuid(),
  recommendation_id uuid not null references recommendations(id) on delete cascade,
  seq               integer not null,
  account_id        uuid not null references accounts(id),
  security_id       uuid not null references securities(id),
  side              text not null check (side in ('buy','sell')),
  quantity          numeric(20,6) not null check (quantity > 0),
  est_price         numeric(20,4) not null check (est_price > 0),
  est_amount        numeric(20,4) not null,
  tax_lot_id        uuid references tax_lots(id),
  superseded        boolean not null default false
);
create unique index recommendation_legs_seq_idx
  on recommendation_legs (recommendation_id, seq) where superseded = false;
-- A modification marks the original legs superseded and inserts a new set. Both survive, so the
-- ledger entry for a modified_approved recommendation can show what was proposed and what was
-- actually approved.

-- ============================================================
-- decision ledger — append-only, hash-chained per firm
-- ============================================================

create table decision_ledger (
  id             bigserial primary key,
  firm_id        uuid not null references firms(id) on delete cascade,
  seq            bigint not null,
  occurred_at    timestamptz not null default now(),
  actor_type     text not null check (actor_type in ('advisor','agent','system')),
  actor_id       uuid,
  agent_identity text,
  event_type     text not null,
  household_id   uuid references households(id) on delete restrict,
  subject_type   text,
  subject_id     uuid,
  payload        jsonb not null,
  data_sources   jsonb not null default '[]'::jsonb,
  prev_hash      text not null,
  row_hash       text not null,
  constraint actor_identified check (
    (actor_type = 'advisor' and actor_id is not null) or
    (actor_type = 'agent'   and agent_identity is not null) or
    (actor_type = 'system')
  )
);
create unique index decision_ledger_seq_idx on decision_ledger (firm_id, seq);
create index decision_ledger_filter_idx on decision_ledger (firm_id, occurred_at desc);
-- households is ON DELETE RESTRICT, not CASCADE. Deleting a household must not be able to delete
-- its audit trail; the household is what an examiner would be asking about.
-- RLS: select firm-scoped, all three roles. INSERT service-role only. UPDATE and DELETE are
--      revoked from every application role AND blocked by trg_ledger_append_only. Two locks,
--      because an examiner should not have to trust a policy alone.

-- ============================================================
-- triggers — the rules that must not depend on application code
-- ============================================================

create or replace function ledger_append_only() returns trigger
language plpgsql as $$
begin
  raise exception 'decision_ledger is append-only (attempted %)', tg_op
    using errcode = 'restrict_violation';
end $$;

create trigger trg_ledger_append_only
  before update or delete on decision_ledger
  for each row execute function ledger_append_only();

create or replace function ledger_hash() returns trigger
language plpgsql as $$
declare last_hash text; last_seq bigint;
begin
  select row_hash, seq into last_hash, last_seq
    from decision_ledger
   where firm_id = new.firm_id
   order by seq desc limit 1
     for update;
  new.prev_hash := coalesce(last_hash, repeat('0', 64));
  new.seq       := coalesce(last_seq, 0) + 1;
  new.row_hash  := encode(digest(
      new.prev_hash          || '|' || new.firm_id::text        || '|' ||
      new.seq::text          || '|' || new.occurred_at::text    || '|' ||
      new.actor_type         || '|' || coalesce(new.actor_id::text,'')       || '|' ||
      coalesce(new.agent_identity,'') || '|' || new.event_type   || '|' ||
      new.payload::text      || '|' || new.data_sources::text,
      'sha256'), 'hex');
  return new;
end $$;

create trigger trg_ledger_hash
  before insert on decision_ledger
  for each row execute function ledger_hash();
-- FOR UPDATE on the tail row serialises concurrent inserts per firm. Without it two simultaneous
-- appends read the same prev_hash and the chain forks — which verification would report as
-- tampering, on a system whose entire compliance claim is that it does not fork.

create or replace function mandate_immutable() returns trigger
language plpgsql as $$
begin
  if old.status = 'published' and new.status = 'published' then
    raise exception 'published mandate v% is immutable; publish a new version', old.version
      using errcode = 'restrict_violation';
  end if;
  return new;
end $$;

create trigger trg_mandate_immutable
  before update on mandates
  for each row execute function mandate_immutable();
-- published -> superseded is permitted. published -> published is not, in any column.

create or replace function recommendation_frozen() returns trigger
language plpgsql as $$
begin
  if new.rationale        is distinct from old.rationale
  or new.guardrail_result is distinct from old.guardrail_result
  or new.provenance       is distinct from old.provenance
  or new.mandate_id       is distinct from old.mandate_id
  or new.run_id           is distinct from old.run_id then
    raise exception 'recommendation reasoning is frozen at creation'
      using errcode = 'restrict_violation';
  end if;
  return new;
end $$;

create trigger trg_recommendation_frozen
  before update on recommendations
  for each row execute function recommendation_frozen();
-- A rationale editable after the advisor acted on it is not an audit trail.
```

---

## 3. API contract

Next.js Route Handlers under `/app/api`. Every route requires an authenticated Supabase session
except `/api/health`. Every route is firm-scoped by RLS; a request for another firm's resource
returns `404`, never `403` — a `403` confirms the resource exists, which is itself a leak.

### Error shape — every route, no exceptions

```
{ error: string; field?: string; detail?: unknown }
```

| Code | Meaning here |
|---|---|
| `400` | malformed request |
| `401` | no session |
| `403` | authenticated, role insufficient |
| `404` | not found, or not in your firm |
| `409` | state conflict — already decided, expired, stale, concurrent publish |
| `422` | validation or **guardrail breach** |
| `423` | shadow mode is on and this path executes |
| `500` | `{ error: 'internal', ref: string }` — `ref` correlates to the log line |

### Mandate

```
GET /api/households/:id/mandate
  200: { mandate: Mandate | null; draft: Mandate | null }

PUT /api/households/:id/mandate/draft
  body: { objective?, riskTarget?, maxDrawdownBps?, taxSensitivity?, realizedGainBudget?,
          minCashBps?, liquidityNeed?, liquidityBy?, rebalanceTrigger?, driftToleranceBps?,
          minTradeAmount?, priceStalenessHours?,
          allocations?: { assetClass, targetBps, minBps, maxBps }[],
          constraints?:  { kind, securityId?, sector?, limitBps?, note? }[],
          autonomy?:     { action, tier, maxTradeAmount?, maxDailyAmount? }[] }
  200: { draft: Mandate }
  422: { error: 'validation', field: string }
  Partial by design — the six-step editor sends only the step it just completed.

POST /api/households/:id/mandate/publish
  body: { draftId: string }
  200: { mandate: Mandate }        -- version N+1, status 'published'
  409: { error: 'concurrent_publish', detail: { currentVersion: number } }
  422: { error: 'allocation_sum', field: 'allocations', detail: { sumBps: number } }
  422: { error: 'unbounded_autonomy', field: 'autonomy', detail: { action: string } }
  Publish-time checks, in order: allocation targets sum to exactly 10000bps; every band ordered;
  every auto_execute tier bounded; liquidity_need <= household market value; at least one
  allocation row. All are refusals, none are corrections.

GET /api/households/:id/mandate/versions
  200: { versions: { version, status, publishedAt, publishedBy, diff }[] }
```

### Ingestion — the custodian port

```
POST /api/custodian/import
  body: multipart — file + { householdId: string; adapter: 'csv' | 'simulated' }
  200: { asOf: string; accounts: number; positions: number; taxLots: number;
         transactions: number; quarantined: { row: number; reason: string }[] }
  409: { error: 'stale_extract', detail: { extractAsOf, currentAsOf } }
  422: { error: 'unparseable', detail: { line: number } }
```

The adapter behind this route is the seam §4 turns on. Every implementation satisfies:

```ts
interface CustodianAdapter {
  readonly id: 'csv' | 'simulated' | 'schwab' | 'fidelity' | 'pershing';
  readonly capabilities: { holdings: boolean; transactions: boolean;
                           taxLots: boolean; orderRouting: boolean };
  fetchSnapshot(ctx: FirmContext, accountRefs: string[]): Promise<CustodianSnapshot>;
  // v1.1+. Absent from the interface in v1.0 rather than stubbed — an unimplemented method
  // that throws is a method callers write against.
  // placeOrders?(ctx: FirmContext, orders: Order[]): Promise<OrderAck[]>;
}

interface CustodianSnapshot {
  asOf: string;
  accounts:     { custodianAccountId, displayName, taxTreatment, cashBalance }[];
  positions:    { custodianAccountId, symbol, cusip?, quantity, marketValue, costBasis }[];
  taxLots:      { custodianAccountId, symbol, custodianLotId?, openDate, quantity, costBasis }[];
  transactions: { custodianAccountId, symbol?, type, tradeDate, settleDate?,
                  quantity?, price?, amount, custodianTxnId? }[];
}
```

`capabilities.orderRouting` is `false` for every v1.0 adapter, and the review workflow reads it —
so the release path is inert because no adapter claims the capability, not because a feature flag
happens to be off.

### Monitoring

```
POST /api/households/:id/runs
  body: {}
  202: { runId: string; status: 'running' }
  409: { error: 'no_published_mandate' }
  409: { error: 'run_in_progress', detail: { runId: string } }

GET /api/runs/:id
  200: { run: AgentRun; steps: AgentStep[]; observations: Observation[];
         recommendations: RecommendationSummary[] }

GET /api/households/:id/drift
  200: { asOf: string; totalMarketValue: string;
         bands: { assetClass, targetBps, minBps, maxBps, actualBps, driftBps,
                  breached: boolean }[] }
  Deterministic. Recomputed on read, never cached — a cached drift number that disagrees with the
  positions it came from is the failure this endpoint exists to prevent.
```

### Recommendations

```
GET /api/recommendations?householdId=&status=
  200: { recommendations: RecommendationSummary[] }

GET /api/recommendations/:id
  200: { recommendation: Recommendation; legs: Leg[]; mandate: MandateSummary;
         guardrail: { pass: boolean; rulesEvaluated: Rule[]; breaches: Breach[] };
         provenance: { positionsAsOf, pricesAsOf, priceSource, mandateVersion,
                       model: string, runId: string } }

POST /api/recommendations/:id/approve
  body: { note?: string }
  200: { status: 'approved'; ledgerSeq: number }
  409: { error: 'already_decided', detail: { status, decidedAt, decidedBy } }
  409: { error: 'expired', detail: { expiresAt } }
  409: { error: 'stale_data', detail: { pricesAsOf } }
  403: { error: 'readonly_role' }

POST /api/recommendations/:id/reject
  body: { reason: string }        -- mandatory, min 1 char
  200: { status: 'rejected'; ledgerSeq: number }
  422: { error: 'reason_required', field: 'reason' }
  409: as approve

POST /api/recommendations/:id/modify
  body: { legs: { accountId, securityId, side, quantity }[]; note?: string }
  200: { status: 'modified_approved'; ledgerSeq: number; guardrail: GuardrailResult }
  422: { error: 'guardrail_breach', detail: { breaches: Breach[] } }
  409: as approve
  The guardrail engine re-runs on the submitted legs. It is the same code path the agent's own
  proposal went through — an advisor's modification is not privileged over the mandate.
```

### Ledger

```
GET /api/ledger?householdId=&actorType=&eventType=&from=&to=&cursor=
  200: { entries: LedgerEntry[]; nextCursor: string | null }

GET /api/ledger/export?<same filters>
  200: text/csv; content-disposition: attachment
  Appends its own `ledger.exported` entry before streaming. An export that is not itself in the
  ledger leaves no record that client data left the system.

GET /api/ledger/verify
  200: { intact: true; entries: number; headHash: string }
  200: { intact: false; firstDivergentSeq: number; expected: string; found: string }
  Recomputes the chain server-side. Returns 200 on a broken chain, not an error status — a
  tamper report is a successful verification, and a 500 here would read as an outage.
```

### Firm, advisors, health

```
PATCH /api/firm/settings
  body: { shadowMode?: boolean; name?: string }
  200: { firm: Firm }
  403: { error: 'principal_only' }

POST /api/advisors/invite
  body: { email: string; fullName: string; role: 'advisor' | 'readonly' }
  200: { advisor: AdvisorProfile }
  403: { error: 'principal_only' }
  409: { error: 'already_member' }

GET /api/health
  200: { ok: true; commit: string; migrations: number }
```

### The guardrail engine — deterministic, not a route

Runs in-process before any recommendation is persisted, and again on every modification. Rules are
evaluated in this order and **all** are evaluated, so a breach report lists every violation rather
than the first:

| # | Rule | Source |
|---|---|---|
| 1 | No leg buys a `prohibited_security` | `mandate_constraints` |
| 2 | No leg buys into a `prohibited_sector` | `mandate_constraints` + `securities.sector` |
| 3 | Post-trade class weights stay within `[min_bps, max_bps]` | `mandate_allocations` |
| 4 | Post-trade single-position weight ≤ `concentration_cap` | `mandate_constraints` |
| 5 | Post-trade cash ≥ `min_cash_bps`, and covers `liquidity_need` | `mandates` |
| 6 | `hold_minimum` positions not sold below their floor | `mandate_constraints` |
| 7 | Realised gains this calendar year ≤ `realized_gain_budget` | `mandates` + `transactions` |
| 8 | No `tax_loss_harvest` leg in a non-`taxable` account | `accounts.tax_treatment` |
| 9 | Each leg ≥ `min_trade_amount` | `mandates` |
| 10 | If tier is `auto_execute`: within `max_trade_amount` and `max_daily_amount` | `mandate_autonomy` |
| 11 | If `firms.shadow_mode`: no execution path may be entered | `firms` |

Result shape, stored verbatim on the recommendation:

```
{ pass: boolean;
  rulesEvaluated: { rule: number; name: string; pass: boolean }[];
  breaches: { rule: number; name: string; detail: unknown }[] }
```

Storing every rule evaluated, not only the failures, is what lets an examiner see that rule 7 was
checked on a recommendation that passed. A result carrying only breaches cannot distinguish
"checked and fine" from "never checked".

---

## 4. Stack decision

Ran [../../skills/stack-decision.md](../../skills/stack-decision.md).

```
Frontend:                Next.js (App Router, TypeScript)
Hosting:                 Vercel
Database, auth, storage: Supabase (Postgres 17, Auth, RLS)
UI components:           21st.dev MCP
```

### Trigger results — all five tested, none skipped

| # | Trigger | Result | Reasoning |
|---|---|---|---|
| 1 | Concurrent editing of shared state needing merge | **no** | Two advisors can hit the same recommendation or mandate, but this is a guarded state transition, not a merge. Solved by `409` on an already-decided row and a partial unique index on the published mandate. No OT, no CRDT. Live dashboard updates are Supabase Realtime, which the skill explicitly excludes from this trigger |
| 2 | Undecomposable work or a specialist runtime | **conditional — see below** | A per-household monitoring cycle is well under 300s and fans out across households on Vercel Queues. **But** two things in the brief could change that answer, and one of them is the reason this escalates |
| 3 | Non-relational or graph-shaped data at scale | **no** | Households → accounts → positions → tax lots → transactions is exactly relational. The ledger is append-only rows, not a document store. Price history is time-series, and at pilot scale (1–3 firms) partitioned Postgres is correct; revisit at ~10⁸ rows, not before |
| 4 | Named third-party integration conflicting with the default stack | **YES** | See the deviation below |
| 5 | Low confidence about which category applies | **YES** | On the market-data question inside trigger 2. Flagging over guessing, per the skill |

### Deviation from default: **none proposed to the stack itself — but the build cannot proceed past this gate without a decision on two integration questions.**

Triggers 4 and 5 both fire. Per the skill, any one `yes` halts. The substantive justification:

**Trigger 4 — which spec text fires it.** The brief, §3: *"At least two major custodians (e.g.,
Schwab Advisor Center + Fidelity or Pershing) for holdings, transactions, and order routing."*

**What the default stack concretely fails to do:**

1. Schwab's advisor APIs and Fidelity Integration Xchange are gated on an approved firm or vendor
   relationship with per-firm OAuth credentials. There is no self-serve key, and no amount of
   engineering produces one. Lead times are commercial, not technical.
2. Where those programmes require IP allowlisting or mutual-TLS client certificates for order
   routing, Vercel Pro serverless functions have **no static outbound IP** — dedicated egress is an
   Enterprise capability. That is a verifiable platform conflict, not a preference.
3. If order routing lands on FIX rather than REST, it needs a session that stays resident between
   requests. That is trigger 2 as well, and a second deployment target with its own failure modes.

**What is proposed instead, and what it costs.** Keep the default stack unchanged and put the
conflict behind a port. `CustodianAdapter` (§3) is the seam. v1.0 ships two implementations: `csv`,
reading the position/transaction extract every custodian can already produce today, and
`simulated`, deterministic fixtures for shadow mode and QA. Schwab and Fidelity implement the same
interface when credentials land. If order routing later needs static egress or a resident FIX
session, **that adapter alone** moves to a small dedicated worker — auth, database, hosting, UI and
every other stage's work stay untouched.

Cost: one interface and two implementations, both throwaway-able. Roughly a day of Stage 3. The
alternative — holding Stage 3 until custodian credentials exist — stalls the build behind a
commercial process neither this pipeline nor Joel fully controls.

**Trigger 5 — the market-data question, which is genuinely open.** The brief asks for a *"Market
data feed (real-time prices + basic fundamentals/news/sentiment)"*, and separately sets the success
metric at *"End-to-end latency for a monitoring cycle + proposal generation... minutes, not
hours."*

Those two point at different architectures. Polled snapshot prices satisfy the stated metric and
fit the default stack with nothing added. A genuine streaming feed is a resident subscription
holding state between requests — trigger 2, a second deployment target, and exchange redistribution
licensing on top. I am not confident which the brief intends, the two cost very different amounts,
and guessing here is exactly what trigger 5 exists to prevent. **This contract assumes polled
snapshots** and the escalation asks Joel to confirm or overturn that.

**One further note, recorded rather than escalated:** the brief names *"LangGraph-style or
equivalent production-ready stack"*. LangGraph proper is Python and a resident service. The
equivalent on this stack is a TypeScript agent graph running inside Vercel functions with Queues
for fan-out, which is decomposable and fits. This is an Architect decision, not an escalation — but
if Joel specifically wants LangGraph the runtime, that is a stack change and should be said now
rather than at Stage 3.

### Plan tiers

Probed at Stage 0.5 this run. Copied from `preflight.md`, not from memory.

```
Supabase:  paid org (Vercel-managed `vercel_icfg_cZt9Cmaa7nMoC30xaBd3fff0`)
           — cloud branching IS available; branch creation bills at $0.01344/hr.
           — QA may use a per-build branch. Branches bill hourly, so they are torn down, not left.
           — all 5 existing projects sit INACTIVE; a new project is required for this build.
           — Postgres 17, pgcrypto available (required by the ledger hash trigger).

Vercel:    Pro (team_TYU1N9pGXUueXJ9JuNumb1MJ)
           — preview deployments and per-branch envs available. Stage 6 unconstrained.
           — 300s function ceiling and no static egress IP. Both are load-bearing above.

21st.dev:  paid — unmetered. freeRetrievalsPerDay: null.
           — Stage 2 Mode B may retrieve as many components as the design needs. No rationing.

Figma:     Full seat on Pro — Dev Mode MCP available by seat.
           — but there is NO Thelma Figma file. Stage 2 derives tokens; it does not extract them.
```

**A plan limit that does bear on this contract:** no static outbound IP on Vercel Pro. It does not
block v1.0 — no v1.0 adapter makes an allowlisted outbound call — and it is why the custodian port
exists rather than a direct integration. Recorded here so Stage 6 does not discover it.

---

## 5. Escalation flag

```
escalation: RESOLVED 2026-08-24 — see amendment A1–A3 below. Was: yes.
reason:     Triggers 4 and 5.

            Trigger 4 — the brief names Schwab Advisor Center, Fidelity and Pershing for holdings,
            transactions AND order routing. Those APIs are gated on firm-level credentials that do
            not exist yet, and their order-routing paths may require static egress IPs or mTLS,
            which Vercel Pro does not provide. The proposed answer is a CustodianAdapter port with
            csv + simulated implementations in v1.0, which keeps the default stack and unblocks
            Stage 3 — but committing the build to a stand-in data source is Joel's call, not the
            Architect's.

            Trigger 5 — "real-time prices" versus "minutes, not hours". Polled snapshots fit the
            default stack; a streaming subscription is a resident process, fires trigger 2, and
            adds exchange redistribution licensing. This contract assumes polled snapshots and
            needs that confirmed before Stage 3 builds against it.

            Stages 2 and 3 do not start until both are answered. Everything else in this contract
            — schema, guardrail engine, ledger, review workflow — is unaffected by either answer
            and is ready to build the moment they land.

            ANSWERED 2026-08-24 by Joel. Amendments A1, A2 and A3 below carry the answers and are
            binding. The stack is unchanged: Next.js / Vercel / Supabase / 21st.dev. Stages 2 and 3
            are released.
```

---

## Amendments

<!--
## <YYYY-MM-DD> — <what changed>
Raised by: <stage>
Clause affected: <section>
Change: <the new binding text>
Downstream impact: <does QA need to regenerate tests? does the schema change?>
-->

## 2026-08-24 — A1: custodian ingestion runs through a data aggregator, not direct custodian APIs

Raised by: Orchestrator, relaying Joel's answer to the Stage 1 escalation.
Clause affected: §1 (deferred table), §2 (new table), §3 (`CustodianAdapter`, import route), §4.

**Change.** v1.0 ingests holdings, transactions and tax lots from a **third-party aggregator**
rather than direct Schwab/Fidelity/Pershing APIs. The `CustodianAdapter` port is unchanged and
still carries the eventual direct adapters; the aggregator is simply another implementation of it.

**Which aggregator, and why it is not a free choice.** The target production adapter is
**ByAllAccounts (Morningstar)**. The two consumer-grade alternatives fail this product on specifics,
and Stage 3 must not silently substitute one:

| Vendor | Disqualifier for Thelma |
|---|---|
| Plaid | Consent is an end-user Link flow — the *account holder* authenticates, not the advisor. The brief puts a client-facing interface explicitly out of scope for v1, so there is no surface on which a client could complete it. Holdings carry position-level cost basis, not lot-level |
| Yodlee | Same consent shape, same lot-level gap |
| **ByAllAccounts** | Advisor/firm-level credentialed data gathering, and lot-level cost basis. Fits both the consent model and `tax_lots` |

Lot-level data is the load-bearing difference. `tax_lots` exists in v1.0 precisely so v1.1 harvesting
needs no migration, and an aggregator that cannot populate it defeats that.

**What Stage 3 actually builds, stated plainly.** No ByAllAccounts credential exists in this
environment, and obtaining one is a Morningstar sales motion. Stage 3 therefore ships:

- `ByAllAccountsAdapter` — written against the documented API shape, **unexercised against a live
  vendor**. It must be marked as such in `build-notes.md`. It is not to be described as working.
- `csv` and `simulated` — the adapters QA actually drives, and the ones the pilot runs on until a
  vendor credential lands.

This is the same reasoning that produced the port in the first place: the seam absorbs a commercial
dependency the build does not control. Choosing an aggregator moves *which* vendor is on the far
side of the seam; it does not remove the seam or the credential problem.

**Schema change — QA must regenerate affected tests.** One new table. Nothing existing changes.

```sql
create type aggregator_status as enum ('pending','connected','error','revoked');

create table aggregator_connections (
  id             uuid primary key default gen_random_uuid(),
  firm_id        uuid not null references firms(id) on delete cascade,
  vendor         text not null check (vendor in ('byallaccounts','csv','simulated')),
  external_id    text,
  status         aggregator_status not null default 'pending',
  last_sync_at   timestamptz,
  last_error     text,
  created_at     timestamptz not null default now()
);
create unique index aggregator_connections_vendor_idx on aggregator_connections (firm_id, vendor);
-- RLS: firm-scoped select for all roles; insert/update principal only.
-- Vendor secrets are NOT stored here. They live in Supabase Vault, referenced by external_id.
-- A credential column on a firm-scoped table readable by three roles is the finding this
-- avoids: `readonly` is a compliance seat and must never be able to read a custodian credential.
```

`accounts.custodian` needs no migration — it was specified as `text`, not an enum, for exactly this.
Its accepted values become `'csv' | 'simulated' | 'byallaccounts' | 'schwab' | 'fidelity' |
'pershing'`.

**API change.** File upload and vendor pull are different shapes and do not belong on one route.

```
POST /api/custodian/import          -- unchanged. File-based: csv.
POST /api/custodian/sync            -- new. Pull-based: byallaccounts, simulated.
  body: { householdId: string; vendor: 'byallaccounts' | 'simulated' }
  202:  { syncId: string; status: 'running' }
  409:  { error: 'not_connected', detail: { vendor, status } }
  409:  { error: 'sync_in_progress' }
  502:  { error: 'vendor_unavailable', detail: { vendor, upstreamStatus } }

GET  /api/custodian/connections     -- new.
  200: { connections: { vendor, status, lastSyncAt, lastError }[] }
```

`CustodianAdapter.capabilities` gains `lotLevelBasis: boolean`. The tax agent reads it and must
degrade to position-level basis rather than fabricate lots when it is `false`.

**Flow bindings — two rows added to §1:**

| Flow | Screen | Control | Calls | Post-condition |
|---|---|---|---|---|
| Sync from aggregator | Settings | "Sync now" | `POST /api/custodian/sync` | sync starts, `last_sync_at` updates, positions/lots/transactions upserted, ledger entry appended |
| Refuse sync when unconnected | Settings | "Sync now" | `POST /api/custodian/sync` | `409 not_connected`, nothing written, connection status shown |

**Downstream impact.** Schema: one new table, one new enum, no changes to existing tables. QA
regenerates ingestion tests to cover both routes and adds the two flow rows above. Design adds a
connections panel to Settings. The guardrail engine, ledger and review workflow are untouched.

---

## 2026-08-24 — A2: market data is polled snapshots. Trigger 2 does not fire

Raised by: Orchestrator, relaying Joel's answer.
Clause affected: §3, §4.

**Change.** Prices are fetched on a schedule and at run start. There is no streaming subscription,
no resident connection, and therefore no second deployment target. Escalation trigger 2 is
confirmed **not** fired, and the assumption §4 flagged is now a decision.

`security_prices` is unchanged — it was already written for dated snapshots with a `source` column
per row.

```ts
interface MarketDataAdapter {
  readonly id: string;
  fetchPrices(symbols: string[], asOf?: Date): Promise<{ symbol, closePrice, priceDate, source }[]>;
}
```

A run reads `mandates.price_staleness_hours` and marks every recommendation `stale_data = true`
when the newest price is older than that. That column already exists and was already read by F3;
this amendment only confirms it is the whole staleness story, with no live feed behind it.

**Downstream impact.** None to schema or existing API. QA's staleness test is unchanged.

---

## 2026-08-24 — A3: the agent runtime is a TypeScript graph on Vercel, not LangGraph

Raised by: Orchestrator, relaying Joel's answer.
Clause affected: §4.

**Change.** The multi-agent architecture — monitor, risk/compliance, tax, proposal, guardrail — is
implemented as a TypeScript agent graph running inside Vercel Functions, with Vercel Queues for
fan-out across households. Not LangGraph, not a Python service, no second deployment target.

Each household's cycle decomposes well under the 300s function ceiling. Traces land in `agent_runs`
and `agent_steps`, which is the observability requirement satisfied in the same Postgres as
everything else rather than in a separate vendor.

The stack line in §4 is unchanged and remains binding:

```
Frontend:                Next.js (App Router, TypeScript)
Hosting:                 Vercel
Database, auth, storage: Supabase (Postgres 17, Auth, RLS)
UI components:           21st.dev MCP
```

**Downstream impact.** None to schema or API. Stage 3 builds the graph in TypeScript.
