-- Stage 5a security findings. Both raised by the Supabase advisors against the live project.
--
-- FINDING 1 — five trigger functions had a role-mutable search_path.
-- A function with an unqualified search_path resolves object names against whatever schemas the
-- caller has in scope. These run during writes performed by the service role, so a schema an
-- attacker could create and place ahead on the path would let them shadow a referenced object.
-- The four RLS helpers already pinned search_path; the trigger functions did not.
--
-- FINDING 2 — four SECURITY DEFINER helpers were EXECUTE-able by `anon`.
-- PostgREST exposes every public function at /rest/v1/rpc/<name>, so an unauthenticated caller
-- could invoke current_firm_id(), current_advisor_role(), is_principal() and can_write(). They
-- return null for anon because auth.uid() is null, so nothing leaked — but a SECURITY DEFINER
-- function reachable without a session is exposed surface with no reason to exist.
-- `authenticated` keeps EXECUTE: the RLS policies call these, and policy expressions are
-- evaluated as the querying role.

alter function public.ledger_append_only()       set search_path = public;
alter function public.ledger_hash()              set search_path = public;
alter function public.mandate_immutable()        set search_path = public;
alter function public.recommendation_frozen()    set search_path = public;
alter function public.decision_by_advisor_only() set search_path = public;

revoke execute on function public.current_firm_id()      from public, anon;
revoke execute on function public.current_advisor_role() from public, anon;
revoke execute on function public.is_principal()         from public, anon;
revoke execute on function public.can_write()            from public, anon;

grant execute on function public.current_firm_id()      to authenticated;
grant execute on function public.current_advisor_role() to authenticated;
grant execute on function public.is_principal()         to authenticated;
grant execute on function public.can_write()            to authenticated;
