# Implementation Notes

## Data ownership

Supabase is the source of truth. Google Drive sheets are read-only inputs, while Obsidian and GitHub Markdown are durable exports for knowledge reuse and versioning.

## Drive import shape

The worker expects each channel spreadsheet to have a `Videos` tab with these headers:

- `公開日`
- `動画タイトル`
- `テーマ要約(AI)`
- `サムネイル画像`
- `URL`
- `1日平均増加(7日間)`
- `D0(最新再生数)`
- `動画時間`
- `高評価数`
- `コメント数`
- `説明`
- `タグ`
- `動画ID`

Non-spreadsheet files in the Drive folder are registered as `assets`.

## Production status flow

`research -> script -> video -> title -> thumbnail -> scheduled -> published -> analyzed`

The UI keeps this flow visible but does not block out-of-order updates in MVP.

