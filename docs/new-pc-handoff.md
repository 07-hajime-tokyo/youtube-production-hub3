# 別PCで作業を続ける手順

このプロジェクトは、コードとGitHub保存用MarkdownをGitHub、アプリをVercel、正本データをSupabase、素材元をGoogle Drive、ローカル文字起こしとObsidian保存を各PC上のworkerで扱います。

## 1. 必要なアカウント権限

- GitHub: `07-hajime-tokyo/youtube-production-hub2` private repoをclone/pushできること
- Vercel: project `youtube-production-hub` にアクセスできること
- Supabase: 対象projectのSQL Editor/Auth/API Keysを見られること
- Google Drive: 対象フォルダ、または対象スプレッドシート一覧を読めること
- Google Cloud: Drive同期用サービスアカウントJSON、またはその内容

## 2. PCに入れるもの

Mac想定です。

```bash
brew install git gh node yt-dlp
npm i -g vercel
/usr/bin/python3 -m pip install --user faster-whisper
```

Supabase CLIはmigrationをCLIで扱う場合だけ必要です。SQL Editorでmigrationを貼る運用なら必須ではありません。

## 3. repoを取得

PRがまだmerge前ならMVPブランチを使います。

```bash
gh auth login
git clone https://github.com/07-hajime-tokyo/youtube-production-hub2.git
cd youtube-production-hub2
npm install
cp .env.example .env.local
```

PR merge後は以下で構いません。

```bash
git switch main
git pull
```

## 4. `.env.local` を作る

`.env.local` はGitに入れません。別PCでは以下を個別に入れてください。

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
ALLOWED_EMAILS=you@example.com,teammate@example.com

GOOGLE_DRIVE_FOLDER_ID=
GOOGLE_DRIVE_SPREADSHEET_IDS=
GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/service-account.json

OBSIDIAN_VAULT_DIR=/absolute/path/to/Obsidian Vault
GITHUB_TRANSCRIPTS_DIR=transcripts
TRANSCRIBE_MODEL=small
YTDLP_BIN=/opt/homebrew/bin/yt-dlp
PYTHON_BIN=/usr/bin/python3
```

`GOOGLE_APPLICATION_CREDENTIALS` に指定するJSONはrepo外に置きます。例: `~/Secrets/youtube-production-hub-drive.json`

## 5. セットアップ確認

```bash
npm run setup:check
npm run lint
npm run build
npm run dev
```

ローカル画面は [http://localhost:3000](http://localhost:3000) です。Supabase未設定でもデモデータで画面確認できます。

## 6. Supabase設定

初回だけ、Supabase SQL Editorで以下を実行します。

```text
supabase/migrations/202605140001_initial_schema.sql
```

Supabase AuthではGoogle providerを有効化し、Redirect URLに少なくとも以下を追加します。

```text
http://localhost:3000/auth/callback
https://<production-domain>/auth/callback
https://<preview-domain>/auth/callback
```

許可ユーザー制御はアプリ側の `ALLOWED_EMAILS` で行います。

## 7. Google Drive同期設定

サービスアカウントのメールアドレスを、対象Google Drive folderに閲覧者として共有します。

設定後に確認します。

```bash
npm run worker:sync-drive
```

## 8. 文字起こし確認

Obsidian Vaultの場所はPCごとに違ってよいです。`OBSIDIAN_VAULT_DIR` だけ合わせてください。

```bash
npm run worker:transcribe -- --url "https://www.youtube.com/watch?v=hUCPzN2FIZQ"
```

成功すると以下に保存されます。

- Supabase: `transcripts`, `transcript_segments`
- Obsidian: `OBSIDIAN_VAULT_DIR` 直下
- GitHub export: `transcripts/YYYY/MM/*.md`

GitHub exportをcommit/pushまで行う場合:

```bash
npm run worker:export-github -- --push
```

## 9. Vercelを別PCから扱う

```bash
vercel login
vercel link
vercel pull --yes --environment preview
vercel build --yes
vercel deploy --prebuilt --yes
```

Productionへ出す場合:

```bash
vercel deploy --prod
```

現在のVercel projectはPreviewがSSO保護されています。外部共有用に公開したい場合は以下で解除します。

```bash
vercel project protection disable youtube-production-hub --sso
```

## 10. 引き継ぎ時に共有する秘密情報

安全な方法で共有してください。GitHubには入れません。

- Supabase project URL
- Supabase anon key
- Supabase service role key
- Google Drive service account JSON
- 許可するGoogleログインメール一覧
- Production URLまたは独自ドメイン
