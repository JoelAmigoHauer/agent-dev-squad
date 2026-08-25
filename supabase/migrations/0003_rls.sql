-- Thelma — row-level security. Contract §1 "Auth requirements".
-- Every table except securities and security_prices is firm-scoped. There is no cross-firm read
-- on any path.

-- SECURITY DEFINER helpers. They read advisor_profiles directly, which is what keeps the
-- policies from recursing through the policy on advisor_profiles itself.

create or replace function current_firm_id() returns uuid
language sql stable security definer set search_path = public as $$
  select firm_id from advisor_profiles where id = auth.uid()
$$;

create or replace function current_advisor_role() returns advisor_role
language sql stable security definer set search_path = public as $$
  select role from advisor_profiles where id = auth.uid()
$$;

create or replace function is_principal() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role from advisor_profiles where id = auth.uid()) = 'principal', false)
$$;

-- `readonly` is a compliance/examiner seat: it reads everything in the firm and writes nothing.
create or replace function can_write() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role from advisor_profiles where id = auth.uid())
                  in ('principal','advisor'), false)
$$;

alter table firms                  enable row level security;
alter table advisor_profiles       enable row level security;
alter table households             enable row level security;
alter table accounts               enable row level security;
alter table securities             enable row level security;
alter table security_prices        enable row level security;
alter table positions              enable row level security;
alter table tax_lots               enable row level security;
alter table transactions           enable row level security;
alter table mandates               enable row level security;
alter table mandate_allocations    enable row level security;
alter table mandate_constraints    enable row level security;
alter table mandate_autonomy       enable row level security;
alter table agent_runs             enable row level security;
alter table agent_steps            enable row level security;
alter table observations           enable row level security;
alter table recommendations        enable row level security;
alter table recommendation_legs    enable row level security;
alter table aggregator_connections enable row level security;
alter table decision_ledger        enable row level security;

-- ---------- firms ----------
create policy firms_read on firms for select
  using (id = current_firm_id());
create policy firms_update on firms for update
  using (id = current_firm_id() and is_principal())
  with check (id = current_firm_id() and is_principal());

-- ---------- advisor_profiles ----------
create policy advisors_read on advisor_profiles for select
  using (firm_id = current_firm_id());
create policy advisors_insert on advisor_profiles for insert
  with check (firm_id = current_firm_id() and is_principal());
create policy advisors_update on advisor_profiles for update
  using (firm_id = current_firm_id() and is_principal())
  with check (firm_id = current_firm_id() and is_principal());

-- ---------- reference data: readable by any authenticated advisor, written by service role ----------
create policy securities_read on securities for select
  using (auth.uid() is not null);
create policy prices_read on security_prices for select
  using (auth.uid() is not null);

-- ---------- firm-scoped tables ----------
-- Same shape repeated deliberately: read within firm, write within firm if can_write().

create policy households_read   on households for select using (firm_id = current_firm_id());
create policy households_write  on households for all
  using (firm_id = current_firm_id() and can_write())
  with check (firm_id = current_firm_id() and can_write());

create policy accounts_read     on accounts for select using (firm_id = current_firm_id());
create policy accounts_write    on accounts for all
  using (firm_id = current_firm_id() and can_write())
  with check (firm_id = current_firm_id() and can_write());

create policy positions_read    on positions for select using (firm_id = current_firm_id());
create policy positions_write   on positions for all
  using (firm_id = current_firm_id() and can_write())
  with check (firm_id = current_firm_id() and can_write());

create policy tax_lots_read     on tax_lots for select using (firm_id = current_firm_id());
create policy tax_lots_write    on tax_lots for all
  using (firm_id = current_firm_id() and can_write())
  with check (firm_id = current_firm_id() and can_write());

create policy transactions_read on transactions for select using (firm_id = current_firm_id());
create policy transactions_write on transactions for all
  using (firm_id = current_firm_id() and can_write())
  with check (firm_id = current_firm_id() and can_write());

create policy mandates_read     on mandates for select using (firm_id = current_firm_id());
create policy mandates_write    on mandates for all
  using (firm_id = current_firm_id() and can_write())
  with check (firm_id = current_firm_id() and can_write());

create policy agent_runs_read   on agent_runs for select using (firm_id = current_firm_id());
create policy agent_runs_write  on agent_runs for all
  using (firm_id = current_firm_id() and can_write())
  with check (firm_id = current_firm_id() and can_write());

create policy observations_read on observations for select using (firm_id = current_firm_id());
create policy observations_write on observations for all
  using (firm_id = current_firm_id() and can_write())
  with check (firm_id = current_firm_id() and can_write());

create policy recommendations_read on recommendations for select using (firm_id = current_firm_id());
create policy recommendations_write on recommendations for all
  using (firm_id = current_firm_id() and can_write())
  with check (firm_id = current_firm_id() and can_write());

create policy aggregator_read on aggregator_connections for select
  using (firm_id = current_firm_id());
create policy aggregator_write on aggregator_connections for all
  using (firm_id = current_firm_id() and is_principal())
  with check (firm_id = current_firm_id() and is_principal());

-- ---------- child tables: scoped through their parent ----------

create policy mandate_allocations_read on mandate_allocations for select
  using (exists (select 1 from mandates m
                  where m.id = mandate_id and m.firm_id = current_firm_id()));
create policy mandate_allocations_write on mandate_allocations for all
  using (exists (select 1 from mandates m
                  where m.id = mandate_id and m.firm_id = current_firm_id()) and can_write())
  with check (exists (select 1 from mandates m
                  where m.id = mandate_id and m.firm_id = current_firm_id()) and can_write());

create policy mandate_constraints_read on mandate_constraints for select
  using (exists (select 1 from mandates m
                  where m.id = mandate_id and m.firm_id = current_firm_id()));
create policy mandate_constraints_write on mandate_constraints for all
  using (exists (select 1 from mandates m
                  where m.id = mandate_id and m.firm_id = current_firm_id()) and can_write())
  with check (exists (select 1 from mandates m
                  where m.id = mandate_id and m.firm_id = current_firm_id()) and can_write());

create policy mandate_autonomy_read on mandate_autonomy for select
  using (exists (select 1 from mandates m
                  where m.id = mandate_id and m.firm_id = current_firm_id()));
create policy mandate_autonomy_write on mandate_autonomy for all
  using (exists (select 1 from mandates m
                  where m.id = mandate_id and m.firm_id = current_firm_id()) and can_write())
  with check (exists (select 1 from mandates m
                  where m.id = mandate_id and m.firm_id = current_firm_id()) and can_write());

create policy agent_steps_read on agent_steps for select
  using (exists (select 1 from agent_runs r
                  where r.id = run_id and r.firm_id = current_firm_id()));
create policy agent_steps_write on agent_steps for all
  using (exists (select 1 from agent_runs r
                  where r.id = run_id and r.firm_id = current_firm_id()) and can_write())
  with check (exists (select 1 from agent_runs r
                  where r.id = run_id and r.firm_id = current_firm_id()) and can_write());

create policy legs_read on recommendation_legs for select
  using (exists (select 1 from recommendations c
                  where c.id = recommendation_id and c.firm_id = current_firm_id()));
create policy legs_write on recommendation_legs for all
  using (exists (select 1 from recommendations c
                  where c.id = recommendation_id and c.firm_id = current_firm_id()) and can_write())
  with check (exists (select 1 from recommendations c
                  where c.id = recommendation_id and c.firm_id = current_firm_id()) and can_write());

-- ---------- decision ledger ----------
-- Read by all three roles including readonly (that is the examiner seat's whole purpose).
-- No insert/update/delete policy exists at all, so PostgREST cannot write it under any role;
-- inserts happen through the service role, which bypasses RLS. Combined with
-- trg_ledger_append_only that is two independent locks, which is the point: an examiner should
-- not have to trust a policy alone.

create policy ledger_read on decision_ledger for select
  using (firm_id = current_firm_id());

revoke update, delete on decision_ledger from anon, authenticated;
