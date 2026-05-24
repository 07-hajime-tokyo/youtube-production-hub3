create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault;

-- Run once before scheduling. Replace the placeholder secret first.
-- select vault.create_secret('https://ulvuuvbuzrinittojgfw.supabase.co', 'project_url');
-- select vault.create_secret('replace-with-a-long-random-string', 'sync_drive_cron_secret');

select cron.unschedule('daily-sync-drive-11am-jst')
where exists (
  select 1
  from cron.job
  where jobname = 'daily-sync-drive-11am-jst'
);

select cron.schedule(
  'daily-sync-drive-11am-jst',
  '0 2 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/sync-drive',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-sync-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'sync_drive_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
