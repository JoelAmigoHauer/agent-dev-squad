-- Thelma — core schema. Implements contract.md §2 plus amendment A1.
-- Numeric policy (contract §2): money numeric(20,4), quantity numeric(20,6),
-- percentages integer basis points. Never float, never cents.

create extension if not exists pgcrypto;

-- ---------- tenancy ----------

create table firms (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  crd_number    text,
  shadow_mode   boolean not null default true,
  created_at    timestamptz not null default now()
);

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

-- ---------- book ----------

create table households (
  id                 uuid primary key default gen_random_uuid(),
  firm_id            uuid not null references firms(id) on delete cascade,
  name               text not null,
  primary_advisor_id uuid references advisor_profiles(id) on delete set null,
  created_at         timestamptz not null default now()
);
create index households_firm_idx on households (firm_id);

create type account_tax_treatment as enum
  ('taxable','traditional_ira','roth_ira','employer_401k','trust','other');

create table accounts (
  id                   uuid primary key default gen_random_uuid(),
  firm_id              uuid not null references firms(id) on delete cascade,
  household_id         uuid not null references households(id) on delete cascade,
  custodian            text not null,
  custodian_account_id text not null,
  display_name         text not null,
  tax_treatment        account_tax_treatment not null,
  cash_balance         numeric(20,4) not null default 0,
  as_of                timestamptz,
  created_at           timestamptz not null default now()
);
create unique index accounts_custodian_key_idx
  on accounts (firm_id, custodian, custodian_account_id);
create index accounts_household_idx on accounts (household_id);

create type asset_class as enum
  ('us_equity','intl_developed_equity','emerging_equity','us_bond','intl_bond',
   'real_assets','cash','other');

-- Global reference data: no firm_id by design. Two firms holding VTI must resolve to the same
-- row or drift arithmetic differs between them.
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

create table security_prices (
  security_id   uuid not null references securities(id) on delete cascade,
  price_date    date not null,
  close_price   numeric(20,4) not null check (close_price > 0),
  source        text not null,
  fetched_at    timestamptz not null default now(),
  primary key (security_id, price_date)
);

-- Dated snapshots, not mutated in place: a recommendation must stay explainable against the
-- holdings that existed when it was made.
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
create index positions_firm_asof_idx on positions (firm_id, as_of desc);

-- Populated at ingest in v1.0, read by nothing until v1.1. Present now because lot-level
-- harvesting cannot be retrofitted — the history it needs would not exist to backfill.
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
-- The 61-day wash-sale window reads this index.
create index transactions_washsale_idx on transactions (account_id, security_id, trade_date);

-- ---------- mandate: the machine-readable IPS ----------

create type mandate_status as enum ('draft','published','superseded');
create type tax_sensitivity as enum ('none','moderate','high');
create type rebalance_trigger as enum ('band','calendar','both');

create table mandates (
  id                    uuid primary key default gen_random_uuid(),
  firm_id               uuid not null references firms(id) on delete cascade,
  household_id          uuid not null references households(id) on delete cascade,
  version               integer not null check (version > 0),
  status                mandate_status not null default 'draft',
  objective             text not null default '',
  risk_target           integer not null default 5 check (risk_target between 1 and 10),
  max_drawdown_bps      integer check (max_drawdown_bps between 0 and 10000),
  tax_sensitivity       tax_sensitivity not null default 'moderate',
  realized_gain_budget  numeric(20,4),
  min_cash_bps          integer not null default 0 check (min_cash_bps between 0 and 10000),
  liquidity_need        numeric(20,4) not null default 0,
  liquidity_by          date,
  rebalance_trigger     rebalance_trigger not null default 'band',
  drift_tolerance_bps   integer not null default 500 check (drift_tolerance_bps > 0),
  min_trade_amount      numeric(20,4) not null default 1000,
  price_staleness_hours integer not null default 24 check (price_staleness_hours > 0),
  published_at          timestamptz,
  published_by          uuid references advisor_profiles(id),
  superseded_at         timestamptz,
  created_at            timestamptz not null default now(),
  created_by            uuid not null references advisor_profiles(id)
);
create unique index mandates_household_version_idx on mandates (household_id, version);
-- Two partial unique indexes carry two rules the application must never be trusted with.
create unique index mandates_one_published_idx on mandates (household_id) where status = 'published';
create unique index mandates_one_draft_idx     on mandates (household_id) where status = 'draft';

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

-- An unbounded auto_execute tier cannot be stored. Graduated autonomy is a database constraint
-- here, not a convention, because a convention is what fails quietly.
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

-- ---------- agent runs, observations, recommendations ----------

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
create unique index agent_runs_one_active_idx on agent_runs (household_id) where status = 'running';

-- step_type 'rejection' is how a guardrail refusal survives: never shown to the advisor, never
-- discarded either. The refusal is part of the audit.
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
create index observations_household_idx on observations (household_id, detected_at desc);

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
-- A modification supersedes the original legs and inserts a new set. Both survive, so a
-- modified_approved recommendation can show what was proposed AND what was approved.
create unique index recommendation_legs_seq_idx
  on recommendation_legs (recommendation_id, seq) where superseded = false;

-- ---------- aggregator connections (amendment A1) ----------

create type aggregator_status as enum ('pending','connected','error','revoked');

-- Vendor secrets are NOT stored here. They live in Supabase Vault, referenced by external_id.
-- `readonly` is a compliance seat and must never be able to read a custodian credential.
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

-- ---------- decision ledger: append-only, hash-chained per firm ----------

-- households is ON DELETE RESTRICT, not CASCADE. Deleting a household must not be able to
-- delete its audit trail — the household is what an examiner would be asking about.
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
