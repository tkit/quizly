# Legacy Learning History Migration

最終更新: 2026-05-02

## 目的

旧 Supabase production database に残っている既存ユーザーの子プロフィール、学習履歴、ポイント、ストリーク、バッジ状態を Cloudflare D1 に移行する。

#34 では Cloudflare runtime / D1 / R2 の受け皿と reference data は移行済みだが、旧 production の user learning history は未移行だったため、#40 で扱う。

## 入力ディレクトリ

import script は D1 target schema に近い JSON export を受け取る。

既定:

```bash
.legacy-supabase-export/
```

対応ファイル:

- `guardian_accounts.json`
- `child_profiles.json`
- `study_sessions.json`
- `study_history.json`
- `point_transactions.json`
- `child_streak_state.json`
- `child_daily_point_state.json`
- `child_learning_stats.json`
- `child_genre_progress.json`
- `child_subject_stats.json`
- `child_badges.json`
- `badge_unlock_events.json`
- `parent_reauth_challenges.json`
- `questions.json` 任意。旧 `study_history.question_id` を D1 の stable question id に自動 map するために使う。

各ファイルは JSON array とする。

## ID Mapping

### Guardian

旧 Supabase auth user id と現在の guardian id が違う場合、mapping file を指定する。

```json
{
  "old-supabase-user-id": "current-clerk-or-future-guardian-id"
}
```

実行時:

```bash
LEGACY_GUARDIAN_MAP_FILE=.legacy-supabase-export/guardian-map.json npm run d1:import:legacy-learning:production
```

mapping がない場合、旧 `guardian_accounts.id` / `child_profiles.guardian_id` をそのまま D1 に入れる。

### Question

旧 `study_history.question_id` が現在の D1 `questions.id` と違う場合、以下のどちらかを使う。

1. `questions.json` を export に含める。`genre_id + question_text` から D1 の stable question id を自動生成する。
2. 明示 mapping file を指定する。

```json
{
  "old-question-id": "current-d1-question-id"
}
```

実行時:

```bash
LEGACY_QUESTION_MAP_FILE=.legacy-supabase-export/question-map.json npm run d1:import:legacy-learning:production
```

## 実行

dry run:

```bash
npm run d1:import:legacy-learning:dry
```

production D1 import:

```bash
LEGACY_EXPORT_DIR=.legacy-supabase-export npm run d1:import:legacy-learning:production
```

validation:

```bash
LEGACY_EXPORT_DIR=.legacy-supabase-export npm run d1:validate:legacy-learning:production
```

## 注意点

- Import は `ON CONFLICT ... DO UPDATE` を使うため再実行可能。
- Supabase 旧 schema が D1 target schema と異なる場合は、export SQL 側で D1 target column 名に alias する。
- `study_history.question_id` は D1 `questions.id` に FK があるため、旧 question id のままでは失敗する可能性がある。
- 旧ユーザーを現在の Clerk Development user に見せるには guardian id mapping が必要になる可能性が高い。
- #39 で auth 方針を変更する場合、guardian id mapping の最終形も再確認する。
