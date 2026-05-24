# sync-drive Edge Function

Google Sheetsの動画台帳をSupabaseへ同期するEdge Functionです。

## Secrets

Supabaseに以下のSecretsを登録します。

```bash
supabase secrets set PROJECT_SUPABASE_URL="https://ulvuuvbuzrinittojgfw.supabase.co"
supabase secrets set PROJECT_SUPABASE_SERVICE_ROLE_KEY="..."
supabase secrets set GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'
supabase secrets set GOOGLE_DRIVE_SPREADSHEET_IDS="sheet_id_1,sheet_id_2,..."
supabase secrets set SYNC_DRIVE_CRON_SECRET="任意の長いランダム文字列"
```

## Deploy

```bash
supabase link --project-ref ulvuuvbuzrinittojgfw
supabase functions deploy sync-drive
```

## Schedule

毎日11:00 JSTに実行するSQLは以下です。

```text
supabase/sql/schedule-sync-drive-11am-jst.sql
```

SQL内のVault secretを登録してから、Supabase SQL Editorで実行します。
