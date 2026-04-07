# 問題コンテンツ同期手順（Content Sync）

最終更新: 2026-04-08

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
UPSTASH_REDIS_REST_URL=http://127.0.0.1:8079
UPSTASH_REDIS_REST_TOKEN=quizly-dev-token
```

補足:
- `SUPABASE_SECRET_KEY` は `NEXT_PUBLIC_*` として公開しない
- dev標準は SRH（`docker redis + serverless-redis-http`）を使う
- `UPSTASH_REDIS_REST_*` が未設定の場合は、現実装どおりキャッシュ無効化をスキップして続行する
- `CONTENT_OBJECT_KEY` は env では受け付けず、CLI引数で必ず指定する

### 2-1. `content-sync` のCLI引数（env上書き）

- `--content-object-key <key>`: 必須。同期対象のStorage Object Key
- `--content-bucket <bucket>`: `CONTENT_BUCKET` を上書き
- `--supabase-url <url>`: `NEXT_PUBLIC_SUPABASE_URL` を上書き
- `--service-role-key <key>`: `SUPABASE_SECRET_KEY` を上書き
- `--upstash-url <url>`: `UPSTASH_REDIS_REST_URL` を上書き
- `--upstash-token <token>`: `UPSTASH_REDIS_REST_TOKEN` を上書き

## 3. 実行手順（上から順）

```bash
# 1) JSON構造チェック
npm run content:validate -- --content-object-key=japanese/grammar/content.json

# 2) 反映差分の確認（DB更新なし）
npm run content:sync:dry -- --content-object-key=japanese/grammar/content.json

# 3) DBへ反映
npm run content:sync -- --content-object-key=japanese/grammar/content.json
```

## 4. 反映ルール

- 対象ジャンル: `genres[].id` を upsert
- 問題キー: `genre_id + question_text`
- 差分時: `options` / `correct_index` / `explanation` / `is_active` を更新
- ソース未掲載問題: 対象ジャンル内で `is_active=false` へ更新

### 4-1. コンテンツJSONフォーマット

オブジェクト形式で `genres` と `questions` を明示します。  
任意の `genre_id` を扱えるため、複数教材の共存登録に向きます。

新形式サンプル:

```json
{
  "genres": [
    {
      "id": "jp-vocab-01",
      "name": "語彙マスター 第1回",
      "parent_id": "japanese",
      "icon_key": "book-open",
      "description": "語彙問題セット",
      "color_hint": "blue"
    }
  ],
  "questions": [
    {
      "genre_id": "jp-vocab-01",
      "question_text": "「端的」の意味は？",
      "options": ["手短で要点をついているさま", "はしの方にあること", "非常に長いこと", "丁寧すぎること"],
      "answer": "手短で要点をついているさま",
      "explanation": "「端的」は、要点を簡潔に示すことです。",
      "is_active": true
    }
  ]
}
```

備考:
- `questions` では `question_text` の代わりに `question`、`options` の代わりに `choices` も使用可
- 正解は `answer` か `correct_index` のどちらかで指定可（`answer` がある場合はそちらを優先）

### 4-2. `icon_key` の決め方

- `icon_key` は [Lucide Icons](https://lucide.dev/icons/) から使いたいアイコンを選んで決める
- ただし、`content-sync` で登録するだけではUIに反映されない
- 実際に表示させるには、選んだキーを [GenreIcon.tsx](/Users/tkitano/work/quizly/src/components/GenreIcon.tsx) の `ICON_BY_KEY` に追加する必要がある
- `ICON_BY_KEY` に未登録の `icon_key` は、UI上で既定アイコン（`BookOpen`）として表示される

## 5. dev / prod での使い分け

- dev:
  - ローカルSupabase起動 + ローカルRedis/SRH起動後に `content:sync` を実行
  - 事前に `.env.content.local` を用意
- prod:
  - 運用手順は `docs/operations_prod.md` を参照
  - 実行前に `SUPABASE_SECRET_KEY` と `UPSTASH_REDIS_REST_*` の設定整合を確認
  - 基本は GitHub Actions の手動Workflow（`.github/workflows/content-sync.yml`）で実行

### 5-1. prodでcommit/pushなしで反映する方法

1. GitHub Actions で `Content Sync (Manual)` を開く
2. `content_object_key` を指定（例: `japanese/grammar/content.json` / `japanese/vocab/content.v1.json`）
3. まず `apply_changes=false` で実行（dry-run確認）
4. 問題なければ `apply_changes=true` で再実行（本反映）

## 6. dev専用テスト問題を登録する手順（prod非反映）

この手順は、**ローカルSupabaseにだけ** テスト問題を入れたい場合の運用です。  
`--content-object-key` を dev専用パスで指定することで、prodの正本JSONと分離します。

### 6-1. 安全確認（prod誤操作防止）

- `.env.local` の `NEXT_PUBLIC_SUPABASE_URL` が `http://127.0.0.1:54321` であることを確認
- `npx supabase status` がローカル接続情報を返すことを確認
- dev専用のオブジェクトキーを決める
  - 例: `japanese/grammar/content.dev-local.json`

### 6-2. dev専用JSONをStorageへ配置

ローカルSupabase Studio（通常 `http://127.0.0.1:54323`）で `quiz-content` バケットに  
dev専用オブジェクト（例: `japanese/grammar/content.dev-local.json`）をアップロードします。

### 6-3. 同期実行

```bash
npm run content:validate -- --content-object-key=japanese/grammar/content.dev-local.json
npm run content:sync:dry -- --content-object-key=japanese/grammar/content.dev-local.json
npm run content:sync -- --content-object-key=japanese/grammar/content.dev-local.json
```

### 6-4. 後片付け（任意）

- 正本コンテンツに戻したい場合:
  - 通常キー（例: `japanese/grammar/content.json`）を指定して `content:sync` を再実行
- ローカルを初期化したい場合:
  - `npx supabase db reset --local` を実行してローカルDBを再構築（履歴/テストデータは消えます）

## 7. 関連ドキュメント

- ローカル開発セットアップ: `docs/setup_dev.md`
- 本番運用（デプロイ/外部設定）: `docs/operations_prod.md`
