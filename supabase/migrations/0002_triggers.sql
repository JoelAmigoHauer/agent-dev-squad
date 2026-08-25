-- Thelma — the rules that must not depend on application code.
-- Contract §2, "triggers". Each of these enforces a governance principle from the brief at the
-- database, where application code cannot route around it.

-- ---------- ledger: append-only ----------

create or replace function ledger_append_only() returns trigger
language plpgsql as $$
begin
  raise exception 'decision_ledger is append-only (attempted %)', tg_op
    using errcode = 'restrict_violation';
end $$;

create trigger trg_ledger_append_only
  before update or delete on decision_ledger
  for each row execute function ledger_append_only();

-- ---------- ledger: hash chain ----------
-- FOR UPDATE on the tail row serialises concurrent inserts per firm. Without it two simultaneous
-- appends read the same prev_hash and the chain forks — which verification would report as
-- tampering, on a system whose entire compliance claim is that it does not fork.

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
      new.prev_hash                   || '|' || new.firm_id::text     || '|' ||
      new.seq::text                   || '|' || new.occurred_at::text || '|' ||
      new.actor_type                  || '|' ||
      coalesce(new.actor_id::text,'') || '|' ||
      coalesce(new.agent_identity,'') || '|' || new.event_type        || '|' ||
      new.payload::text               || '|' || new.data_sources::text,
      'sha256'), 'hex');
  return new;
end $$;

create trigger trg_ledger_hash
  before insert on decision_ledger
  for each row execute function ledger_hash();

-- ---------- mandate immutability ----------
-- published -> superseded is permitted. published -> published is not, in any column.

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

-- ---------- recommendation reasoning is frozen ----------
-- A rationale editable after the advisor acted on it is not an audit trail.

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

-- ---------- the agent can never be the decider ----------
-- Contract §1 auth: "no code path exists that sets decided_by to a non-advisor". A trigger is
-- how that becomes true rather than aspirational.

create or replace function decision_by_advisor_only() returns trigger
language plpgsql as $$
begin
  if new.decided_by is not null
     and not exists (select 1 from advisor_profiles p where p.id = new.decided_by) then
    raise exception 'decided_by must reference an advisor'
      using errcode = 'restrict_violation';
  end if;
  if new.status in ('approved','rejected','modified_approved')
     and new.decided_by is null then
    raise exception 'a decided recommendation must name the advisor who decided it'
      using errcode = 'restrict_violation';
  end if;
  return new;
end $$;

create trigger trg_decision_by_advisor_only
  before insert or update on recommendations
  for each row execute function decision_by_advisor_only();
