-- Central de Ações do QualiHub.
-- Acesso deliberadamente restrito ao dono autenticado de cada ação.
-- Nenhuma permissão é concedida ao papel anon.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.quality_actions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  origin_type text not null check (origin_type in ('IDF', 'ALERTA', 'RNC', 'MANUAL')),
  origin_id text,
  title text not null check (length(trim(title)) between 3 and 160),
  description text not null default '',
  supplier text,
  division text,
  item text,
  lot text,
  responsible text not null,
  due_date date,
  priority text not null default 'media' check (priority in ('baixa', 'media', 'alta', 'critica')),
  status text not null default 'aberta' check (status in ('aberta', 'em_andamento', 'bloqueada', 'concluida', 'cancelada')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index quality_actions_owner_status_idx on public.quality_actions(owner_id, status);
create index quality_actions_due_date_idx on public.quality_actions(due_date) where due_date is not null;
create index quality_actions_origin_idx on public.quality_actions(origin_type, origin_id);

create table public.quality_action_comments (
  id uuid primary key default gen_random_uuid(),
  action_id uuid not null references public.quality_actions(id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index quality_action_comments_action_idx on public.quality_action_comments(action_id, created_at);

create table public.quality_action_attachments (
  id uuid primary key default gen_random_uuid(),
  action_id uuid not null references public.quality_actions(id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  content_type text,
  size_bytes bigint check (size_bytes is null or size_bytes between 0 and 10485760),
  created_at timestamptz not null default now(),
  unique (owner_id, storage_path)
);

create index quality_action_attachments_action_idx on public.quality_action_attachments(action_id, created_at);

create table public.quality_action_history (
  id bigint generated always as identity primary key,
  action_id uuid not null references public.quality_actions(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('created', 'updated')),
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create index quality_action_history_action_idx on public.quality_action_history(action_id, created_at desc);

alter table public.quality_actions enable row level security;
alter table public.quality_action_comments enable row level security;
alter table public.quality_action_attachments enable row level security;
alter table public.quality_action_history enable row level security;

revoke all on table public.quality_actions from anon, authenticated;
revoke all on table public.quality_action_comments from anon, authenticated;
revoke all on table public.quality_action_attachments from anon, authenticated;
revoke all on table public.quality_action_history from anon, authenticated;
revoke all on sequence public.quality_action_history_id_seq from anon, authenticated;

grant select, insert, update, delete on table public.quality_actions to authenticated;
grant select, insert, delete on table public.quality_action_comments to authenticated;
grant select, insert, delete on table public.quality_action_attachments to authenticated;
grant select on table public.quality_action_history to authenticated;

create policy "quality_actions_select_own"
on public.quality_actions for select to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = owner_id);

create policy "quality_actions_insert_own"
on public.quality_actions for insert to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = owner_id);

create policy "quality_actions_update_own"
on public.quality_actions for update to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = owner_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = owner_id);

create policy "quality_actions_delete_own"
on public.quality_actions for delete to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = owner_id);

create policy "quality_action_comments_select_own_action"
on public.quality_action_comments for select to authenticated
using (
  (select auth.uid()) is not null
  and exists (
    select 1 from public.quality_actions qa
    where qa.id = action_id and qa.owner_id = (select auth.uid())
  )
);

create policy "quality_action_comments_insert_own_action"
on public.quality_action_comments for insert to authenticated
with check (
  (select auth.uid()) is not null
  and owner_id = (select auth.uid())
  and exists (
    select 1 from public.quality_actions qa
    where qa.id = action_id and qa.owner_id = (select auth.uid())
  )
);

create policy "quality_action_comments_delete_own"
on public.quality_action_comments for delete to authenticated
using ((select auth.uid()) is not null and owner_id = (select auth.uid()));

create policy "quality_action_attachments_select_own_action"
on public.quality_action_attachments for select to authenticated
using (
  (select auth.uid()) is not null
  and exists (
    select 1 from public.quality_actions qa
    where qa.id = action_id and qa.owner_id = (select auth.uid())
  )
);

create policy "quality_action_attachments_insert_own_action"
on public.quality_action_attachments for insert to authenticated
with check (
  (select auth.uid()) is not null
  and owner_id = (select auth.uid())
  and exists (
    select 1 from public.quality_actions qa
    where qa.id = action_id and qa.owner_id = (select auth.uid())
  )
);

create policy "quality_action_attachments_delete_own"
on public.quality_action_attachments for delete to authenticated
using ((select auth.uid()) is not null and owner_id = (select auth.uid()));

create policy "quality_action_history_select_own"
on public.quality_action_history for select to authenticated
using ((select auth.uid()) is not null and owner_id = (select auth.uid()));

create or replace function private.log_quality_action_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or auth.uid() <> new.owner_id then
    raise exception 'Unauthorized quality action history event';
  end if;

  insert into public.quality_action_history (
    action_id,
    owner_id,
    actor_id,
    event_type,
    snapshot
  ) values (
    new.id,
    new.owner_id,
    (select auth.uid()),
    case when tg_op = 'INSERT' then 'created' else 'updated' end,
    to_jsonb(new)
  );
  return new;
end;
$$;

revoke all on function private.log_quality_action_history() from public, anon, authenticated;

create trigger quality_actions_history_trigger
after insert or update on public.quality_actions
for each row execute function private.log_quality_action_history();

drop trigger if exists quality_actions_touch_updated_at on public.quality_actions;
create trigger quality_actions_touch_updated_at
before update on public.quality_actions
for each row execute function public.touch_updated_at();

insert into storage.buckets (id, name, public, file_size_limit)
values ('quality-action-attachments', 'quality-action-attachments', false, 10485760)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

create policy "quality_action_files_select_own"
on storage.objects for select to authenticated
using (
  bucket_id = 'quality-action-attachments'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "quality_action_files_insert_own"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'quality-action-attachments'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "quality_action_files_update_own"
on storage.objects for update to authenticated
using (
  bucket_id = 'quality-action-attachments'
  and owner_id = (select auth.uid())
)
with check (
  bucket_id = 'quality-action-attachments'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "quality_action_files_delete_own"
on storage.objects for delete to authenticated
using (
  bucket_id = 'quality-action-attachments'
  and owner_id = (select auth.uid())
);
