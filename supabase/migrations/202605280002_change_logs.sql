create table if not exists change_logs (
  id uuid primary key default gen_random_uuid(),
  app_key text not null,
  action text not null,
  target_type text not null,
  target_id text,
  title text not null,
  detail text,
  actor_email text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists change_logs_app_key_created_at_idx on change_logs(app_key, created_at desc);

alter table change_logs enable row level security;

drop policy if exists change_logs_team_read on change_logs;
create policy change_logs_team_read on change_logs
for select to authenticated
using (app.is_team_member());

drop policy if exists change_logs_team_insert on change_logs;
create policy change_logs_team_insert on change_logs
for insert to authenticated
with check (app.is_team_member());
