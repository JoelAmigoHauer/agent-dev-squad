-- A5: decision_ledger.firm_id must not cascade.
-- A cascade from firms issues a DELETE against decision_ledger, which trg_ledger_append_only
-- refuses — so the cascade was a promise the schema could not keep, and it failed with a trigger
-- error rather than a foreign-key violation. RESTRICT matches household_id in the same table and
-- makes the refusal explicit at the constraint rather than incidental at the trigger.
alter table decision_ledger
  drop constraint decision_ledger_firm_id_fkey,
  add constraint decision_ledger_firm_id_fkey
    foreign key (firm_id) references firms(id) on delete restrict;
