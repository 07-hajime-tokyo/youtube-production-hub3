create extension if not exists pgcrypto;

create schema if not exists app;

do $$
begin
  create type production_status as enum (
    'research',
    'script',
    'video',
    'title',
    'thumbnail',
    'scheduled',
    'published',
    'analyzed'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type asset_type as enum (
    'drive_sheet',
    'drive_pdf',
    'drive_video',
    'thumbnail',
    'script',
    'manual',
    'other'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type sync_run_type as enum (
    'drive',
    'transcribe',
    'github_export'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type sync_run_status as enum (
    'queued',
    'running',
    'success',
    'failed'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type worker_job_type as enum (
    'sync_drive',
    'transcribe',
    'export_github'
  );
exception when duplicate_object then null;
end $$;

create table if not exists team_members (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  display_name text,
  role text not null default 'member',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists channels (
  id uuid primary key default gen_random_uuid(),
  drive_file_id text unique,
  drive_sheet_name text not null unique,
  youtube_channel_name text,
  genre text,
  status text not null default 'active',
  source_url text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists videos (
  id uuid primary key default gen_random_uuid(),
  video_id text not null unique,
  channel_id uuid references channels(id) on delete set null,
  title text not null,
  theme_summary text,
  thumbnail_url text,
  url text not null,
  published_on date,
  duration_text text,
  duration_seconds integer,
  description text,
  tags text[] not null default '{}',
  like_count integer,
  comment_count integer,
  production_status production_status not null default 'research',
  assigned_to text,
  due_on date,
  notes text,
  drive_source_file_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists video_metrics_daily (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references videos(id) on delete cascade,
  metric_date date not null,
  view_count integer,
  like_count integer,
  comment_count integer,
  seven_day_average_growth numeric,
  created_at timestamptz not null default now(),
  unique(video_id, metric_date)
);

create table if not exists transcripts (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references videos(id) on delete cascade,
  source_url text not null,
  full_text text not null,
  summary text,
  asr_engine text not null default 'faster-whisper',
  asr_model text not null default 'small',
  language text not null default 'ja',
  obsidian_path text,
  github_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(video_id)
);

create table if not exists transcript_segments (
  id uuid primary key default gen_random_uuid(),
  transcript_id uuid not null references transcripts(id) on delete cascade,
  segment_index integer not null,
  start_seconds numeric not null,
  end_seconds numeric not null,
  text text not null,
  unique(transcript_id, segment_index)
);

create table if not exists production_items (
  id uuid primary key default gen_random_uuid(),
  video_id uuid references videos(id) on delete cascade,
  status production_status not null default 'research',
  assignee_email text,
  due_on date,
  memo text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists assets (
  id uuid primary key default gen_random_uuid(),
  video_id uuid references videos(id) on delete cascade,
  channel_id uuid references channels(id) on delete cascade,
  type asset_type not null default 'other',
  title text not null,
  url text,
  drive_file_id text unique,
  mime_type text,
  extracted_text text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sync_runs (
  id uuid primary key default gen_random_uuid(),
  type sync_run_type not null,
  status sync_run_status not null default 'queued',
  message text,
  metadata jsonb not null default '{}',
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists worker_jobs (
  id uuid primary key default gen_random_uuid(),
  type worker_job_type not null,
  status sync_run_status not null default 'queued',
  payload jsonb not null default '{}',
  run_after timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  attempts integer not null default 0,
  last_error text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists videos_channel_id_idx on videos(channel_id);
create index if not exists videos_published_on_idx on videos(published_on desc);
create index if not exists videos_production_status_idx on videos(production_status);
create index if not exists worker_jobs_status_idx on worker_jobs(status, run_after);

create or replace function app.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_channels_updated_at on channels;
create trigger touch_channels_updated_at
before update on channels
for each row execute function app.touch_updated_at();

drop trigger if exists touch_videos_updated_at on videos;
create trigger touch_videos_updated_at
before update on videos
for each row execute function app.touch_updated_at();

drop trigger if exists touch_transcripts_updated_at on transcripts;
create trigger touch_transcripts_updated_at
before update on transcripts
for each row execute function app.touch_updated_at();

drop trigger if exists touch_production_items_updated_at on production_items;
create trigger touch_production_items_updated_at
before update on production_items
for each row execute function app.touch_updated_at();

drop trigger if exists touch_assets_updated_at on assets;
create trigger touch_assets_updated_at
before update on assets
for each row execute function app.touch_updated_at();

drop trigger if exists touch_worker_jobs_updated_at on worker_jobs;
create trigger touch_worker_jobs_updated_at
before update on worker_jobs
for each row execute function app.touch_updated_at();

create or replace function app.is_team_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from team_members
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and active = true
  );
$$;

alter table team_members enable row level security;
alter table channels enable row level security;
alter table videos enable row level security;
alter table video_metrics_daily enable row level security;
alter table transcripts enable row level security;
alter table transcript_segments enable row level security;
alter table production_items enable row level security;
alter table assets enable row level security;
alter table sync_runs enable row level security;
alter table worker_jobs enable row level security;

drop policy if exists team_members_select_own_team on team_members;
create policy team_members_select_own_team on team_members
for select to authenticated
using (app.is_team_member());

drop policy if exists team_members_insert_self on team_members;
create policy team_members_insert_self on team_members
for insert to authenticated
with check (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

drop policy if exists channels_team_read on channels;
create policy channels_team_read on channels for select to authenticated using (app.is_team_member());
drop policy if exists videos_team_read on videos;
create policy videos_team_read on videos for select to authenticated using (app.is_team_member());
drop policy if exists metrics_team_read on video_metrics_daily;
create policy metrics_team_read on video_metrics_daily for select to authenticated using (app.is_team_member());
drop policy if exists transcripts_team_read on transcripts;
create policy transcripts_team_read on transcripts for select to authenticated using (app.is_team_member());
drop policy if exists segments_team_read on transcript_segments;
create policy segments_team_read on transcript_segments for select to authenticated using (app.is_team_member());
drop policy if exists production_items_team_read on production_items;
create policy production_items_team_read on production_items for select to authenticated using (app.is_team_member());
drop policy if exists assets_team_read on assets;
create policy assets_team_read on assets for select to authenticated using (app.is_team_member());
drop policy if exists sync_runs_team_read on sync_runs;
create policy sync_runs_team_read on sync_runs for select to authenticated using (app.is_team_member());
drop policy if exists worker_jobs_team_read on worker_jobs;
create policy worker_jobs_team_read on worker_jobs for select to authenticated using (app.is_team_member());

drop policy if exists videos_team_update on videos;
create policy videos_team_update on videos
for update to authenticated
using (app.is_team_member())
with check (app.is_team_member());

drop policy if exists production_items_team_write on production_items;
create policy production_items_team_write on production_items
for all to authenticated
using (app.is_team_member())
with check (app.is_team_member());

drop policy if exists worker_jobs_team_insert on worker_jobs;
create policy worker_jobs_team_insert on worker_jobs
for insert to authenticated
with check (app.is_team_member());

drop policy if exists sync_runs_team_insert on sync_runs;
create policy sync_runs_team_insert on sync_runs
for insert to authenticated
with check (app.is_team_member());
