begin;

drop policy if exists sessions_insert_own_or_admin on public.sessions;
create policy sessions_insert_own_or_admin on public.sessions
  for insert to authenticated
  with check (user_id = (select auth.uid()) or (select public.is_studio_admin()));

commit;
