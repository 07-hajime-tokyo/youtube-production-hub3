# YouTube Production Hub

Driveの動画台帳、ローカル文字起こし、Obsidian Markdown、GitHub Markdown、SupabaseをつなぐYouTube制作管理MVPです。

## 構成

- App: Next.js + TypeScript + Tailwind
- Auth: Supabase Auth Google OAuth + `ALLOWED_EMAILS`
- DB: Supabase SQL migration in `supabase/migrations`
- Worker: `yt-dlp + faster-whisper` をローカルMacで実行
- Source: Google Drive folder `1WXq2-aIGa8eIcVouwC6CY3yozw6l0y5s`
- Obsidian: `/Users/ha_m/Desktop/Obsidian Vault` 直下へ保存
- GitHub export: `transcripts/YYYY/MM/*.md`

## 初期セットアップ

```bash
npm install
cp .env.example .env.local
```

`.env.local` にSupabaseとGoogle Driveの値を入れます。

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
ALLOWED_EMAILS=you@example.com,teammate@example.com
GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/service-account.json
OBSIDIAN_VAULT_DIR=/Users/ha_m/Desktop/Obsidian Vault
```

Supabase側で `supabase/migrations/202605140001_initial_schema.sql` を実行してください。Supabase AuthのGoogle Providerも有効化し、callback URLに `http://localhost:3000/auth/callback` を入れます。

## 開発

```bash
npm run dev
```

Supabase未設定でもデモデータで画面確認できます。実データ運用ではGoogleログイン後にDrive同期や文字起こしジョブを投入します。

別PCで作業を続ける場合は [docs/new-pc-handoff.md](./docs/new-pc-handoff.md) を使います。

```bash
npm run setup:check
```

## Worker

Web画面のボタンは `worker_jobs` にジョブを積むだけです。実処理はローカルworkerで実行します。

```bash
npm run worker:sync-drive
npm run worker:transcribe -- --url "https://www.youtube.com/watch?v=hUCPzN2FIZQ"
npm run worker:export-github
```

初回確認で3チャンネルだけ同期する場合:

```bash
npm run worker:sync-drive -- --spreadsheetIds 1fbS6vJqkrMamrdtLzZwR8AI7q3Kkf2y996IBnUqqxK4,1lS9BJnk9h0_gL37b5y0YZnLGa7STr7AMsGfFohjnAQk,1Q336hvddoW-FC0emG6le8pVaimebXF12yATVoVrCnnQ
```

対象は `pivot`、`TBS CROSS DIG`、`世界が称賛するJAPAN` です。

キューを1件処理する場合:

```bash
npm run worker
```

## 無料文字起こし

初回のみMacに依存ツールを入れます。

```bash
brew install yt-dlp
/usr/bin/python3 -m pip install --user faster-whisper
```

処理結果は以下に保存されます。

- Supabase: `transcripts`, `transcript_segments`
- Obsidian: Vault直下の `YYYY-MM-DD タイトル.md`
- GitHub: `transcripts/YYYY/MM/YYYY-MM-DD__videoId__title.md`

## GitHub運用

private repoとして使う想定です。

```bash
git remote add origin https://github.com/talkjapan999-ux/youtube-production-hub.git
git push -u origin main
```

文字起こしMarkdownをコミット・pushまでworkerに任せる場合:

```bash
npm run worker:export-github -- --push
```
