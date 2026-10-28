-- Run once in the SQL editor of your own Supabase project.
begin;
create table if not exists public.training_records (
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  id text not null check (length(id) between 1 and 100),
  kind text not null check (kind in ('profile','exercise','program','session','weight')),
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and payload->>'id' = id),
  version uuid not null,
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
alter table public.training_records enable row level security;
revoke all on public.training_records from anon;
grant select, insert, update on public.training_records to authenticated;
drop policy if exists "Users read own records" on public.training_records;
create policy "Users read own records" on public.training_records for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users insert own records" on public.training_records;
create policy "Users insert own records" on public.training_records for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Users update own records" on public.training_records;
create policy "Users update own records" on public.training_records for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Compare-and-swap, including deletion tombstones. Concurrent edits are returned
-- to the client as conflicts rather than silently overwritten. Invoker keeps RLS.
create or replace function public.push_training_record(
  p_id text, p_kind text, p_payload jsonb, p_deleted boolean,
  p_base_version uuid, p_version uuid
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  current_record public.training_records;
  result_record public.training_records;
  viewer uuid := auth.uid();
begin
  if viewer is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  -- Serialize even the first insert, when there is no existing row to lock.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(viewer::text || ':' || p_id, 0));
  select * into current_record from public.training_records where user_id = viewer and id = p_id for update;
  if found then
    if current_record.version = p_version then
      return jsonb_build_object('accepted', true, 'record', to_jsonb(current_record));
    end if;
    if current_record.version is distinct from p_base_version then
      return jsonb_build_object('accepted', false, 'record', to_jsonb(current_record));
    end if;
    update public.training_records set kind = p_kind, payload = p_payload, deleted = p_deleted, version = p_version, updated_at = now()
      where user_id = viewer and id = p_id returning * into result_record;
  else
    if p_base_version is not null then raise exception 'Remote record missing; restore from a backup before retrying'; end if;
    insert into public.training_records(user_id,id,kind,payload,deleted,version)
      values(viewer,p_id,p_kind,p_payload,p_deleted,p_version) returning * into result_record;
  end if;
  return jsonb_build_object('accepted', true, 'record', to_jsonb(result_record));
end;
$$;
revoke all on function public.push_training_record(text,text,jsonb,boolean,uuid,uuid) from public, anon;
grant execute on function public.push_training_record(text,text,jsonb,boolean,uuid,uuid) to authenticated;
commit;
