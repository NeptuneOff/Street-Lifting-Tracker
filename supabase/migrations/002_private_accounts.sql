-- Existing installations: run after 001_training_records.sql. No data is deleted.
begin;
alter table public.training_records enable row level security;
alter table public.training_records force row level security;
revoke all on public.training_records from public, anon;
grant select, insert, update on public.training_records to authenticated;
-- Restrictive policy also protects against an accidentally broad permissive policy.
drop policy if exists "Account isolation guard" on public.training_records;
create policy "Account isolation guard" on public.training_records as restrictive
  for all to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);
revoke all on function public.push_training_record(text,text,jsonb,boolean,uuid,uuid) from public, anon;
grant execute on function public.push_training_record(text,text,jsonb,boolean,uuid,uuid) to authenticated;
commit;
