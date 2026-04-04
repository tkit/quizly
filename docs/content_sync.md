# 問題コンテンツ同期手順（Content Sync）

最終更新: 2026-04-04

本書は、問題コンテンツ（`genres/questions`）を更新する正本手順です。  
`migration` はスキーマ変更用、`content:sync` は問題データ更新用として使い分けます。

## 1. 目的と前提

- 問題コンテンツは Supabase Storage 上の JSON を正本として管理
- `content:sync` で DB（`genres/questions`）へ反映
- JSONから消えた問題は削除せず `is_active=false` にする（履歴保全）

## 2. 必要な環境変数

`.env.content.local`（ローカル実行時）または実行環境の秘密情報として設定します。

```bash
SUPABASE_SECRET_KEY=<service-role-key>
CONTENT_BUCKET=quiz-content
CONTENT_OBJECT_KEY=japanese/grammar/content.json
UPSTASH_REDIS_REST_URL=<optional>
UPSTASH_REDIS_REST_TOKEN=<optional>
```

補足:
- `SUPABASE_SECRET_KEY` は `NEXT_PUBLIC_*` として公開しない
- `UPSTASH_REDIS_REST_*` は設定時のみキャッシュ無効化を実行

## 3. 実行手順（上から順）

```bash
# 1) JSON構造チェック
npm run content:validate

# 2) 反映差分の確認（DB更新なし）
npm run content:sync:dry

# 3) DBへ反映
npm run content:sync
```

## 4. 反映ルール

- 対象ジャンル: `jp-grammar-01..20` を upsert
- 問題キー: `genre_id + question_text`
- 差分時: `options` / `correct_index` / `explanation` / `is_active` を更新
- ソース未掲載問題: `is_active=false` へ更新

## 5. dev / prod での使い分け

- dev:
  - ローカルSupabase起動後、必要に応じて `content:sync` を実行
  - 事前に `.env.content.local` を用意
- prod:
  - 運用手順は `docs/operations_prod.md` を参照
  - 実行前に `SUPABASE_SECRET_KEY` と `UPSTASH_REDIS_REST_*` の設定整合を確認
  - 基本は GitHub Actions の手動Workflow（`.github/workflows/content-sync.yml`）で実行

### 5-1. prodでcommit/pushなしで反映する方法

1. GitHub Actions で `Content Sync (Manual)` を開く
2. `content_object_key` を指定（通常: `japanese/grammar/content.json`）
3. まず `apply_changes=false` で実行（dry-run確認）
4. 問題なければ `apply_changes=true` で再実行（本反映）

## 6. dev専用テスト問題を登録する手順（prod非反映）

この手順は、**ローカルSupabaseにだけ** テスト問題を入れたい場合の運用です。  
`CONTENT_OBJECT_KEY` を dev専用パスに切り替えることで、prodの正本JSONと分離します。

### 6-1. 安全確認（prod誤操作防止）

- `.env.local` の `NEXT_PUBLIC_SUPABASE_URL` が `http://127.0.0.1:54321` であることを確認
- `npx supabase status` がローカル接続情報を返すことを確認
- `.env.content.local` の `CONTENT_OBJECT_KEY` を dev専用値へ変更
  - 例: `japanese/grammar/content.dev-local.json`

### 6-2. dev専用JSONをStorageへ配置

ローカルSupabase Studio（通常 `http://127.0.0.1:54323`）で `quiz-content` バケットに  
`CONTENT_OBJECT_KEY` で指定した dev専用オブジェクトをアップロードします。

### 6-3. 同期実行

```bash
npm run content:validate
npm run content:sync:dry
npm run content:sync
```

### 6-4. 後片付け（任意）

- 正本コンテンツに戻したい場合:
  - `.env.content.local` の `CONTENT_OBJECT_KEY` を通常値（例: `japanese/grammar/content.json`）へ戻して `content:sync` を再実行
- ローカルを初期化したい場合:
  - `npx supabase db reset --local` を実行してローカルDBを再構築（履歴/テストデータは消えます）

## 7. 関連ドキュメント

- ローカル開発セットアップ: `docs/setup_dev.md`
- 本番運用（デプロイ/外部設定）: `docs/operations_prod.md`
