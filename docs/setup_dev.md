# ローカル開発セットアップ手順（dev）

最終更新: 2026-04-05

この手順は **上から順に実行** すれば、ローカル開発環境を起動できます。  
本番運用（prod）は `docs/operations_prod.md` を参照してください。

## 1. 前提ツール

- Node.js 18+（推奨: 20+）
- Docker Desktop（起動済み）
- Supabase CLI（`npx supabase` で実行可能）

## 2. 環境変数を用意

### 2-0. `.env*.local` 使い分け早見表

| ファイル | 主用途 | 主に使うコマンド |
|---|---|---|
| `.env.local` | Next.jsアプリ本体（ローカル接続） | `npm run dev` |
| `.env.content.local` | 問題同期/投入スクリプト（service role） | `npm run content:*`, `npm run db:local:seed:legacy-samples*` |
| `.env.supabase.local` | Supabase CLI の prod接続情報（通常はCI向け。ローカル手動操作時のみ） | `npm run db:prod:*` |

補足:
- `.env.migration.local` は現行運用では使用しません（過去移行作業用）。
- prod本番運用は `docs/operations_prod.md` を正本とします。

### 2-1. `.env.local` を作成

```bash
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<local-publishable-key>
NEXT_PUBLIC_QUESTION_IMAGE_BUCKET=quiz-images
NEXT_PUBLIC_AUTH_MODE=development
NEXT_PUBLIC_ENABLE_DEV_AUTH_SHORTCUT=true
UPSTASH_REDIS_REST_URL=http://127.0.0.1:8079
UPSTASH_REDIS_REST_TOKEN=quizly-dev-token
```

`<local-publishable-key>` は手順 4 で取得します。

### 2-2. （必要時のみ）`.env.content.local` を作成

次の手順を使う場合のみ必要です。

- `npm run db:local:seed:legacy-samples*`
- `npm run content:*`

```bash
SUPABASE_SECRET_KEY=<local-secret-key>
CONTENT_BUCKET=quiz-content
QUESTION_IMAGE_BUCKET=quiz-images
UPSTASH_REDIS_REST_URL=http://127.0.0.1:8079
UPSTASH_REDIS_REST_TOKEN=quizly-dev-token
```

## 3. ローカルSupabaseを起動

```bash
npm run db:local:start
```

## 3-1. ローカルRedis + SRHを起動

```bash
npm run redis:local:start
```

状態確認:

```bash
npm run redis:local:status
```

Redis/SRH 疎通確認（HTTP 200 と `result` を確認）:

```bash
curl -sS -X POST http://127.0.0.1:8079 \
  -H "Authorization: Bearer quizly-dev-token" \
  -H "Content-Type: application/json" \
  -d '["SET","quizly:dev:health","ok"]'

curl -sS -X POST http://127.0.0.1:8079 \
  -H "Authorization: Bearer quizly-dev-token" \
  -H "Content-Type: application/json" \
  -d '["GET","quizly:dev:health"]'
```

## 4. ローカル接続情報を確認

```bash
npx supabase status
```

設定対応:

- `Project URL` -> `NEXT_PUBLIC_SUPABASE_URL`
- `Publishable` -> `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `Secret` -> `SUPABASE_SECRET_KEY`（`.env.content.local` 用）

## 5. migrationを適用

```bash
npm run db:local:migration:up
```

適用状況確認:

```bash
npm run db:local:status
```

## 6. アプリを起動

```bash
npm install
npm run dev
```

ブラウザ: `http://localhost:3000`

## 7. ログイン確認（開発ショートカット）

- ログイン画面で「開発ショートカットでログイン」を使用
- `Anonymous sign-ins are disabled` が出る場合:
  - `supabase/config.toml` の `auth.enable_anonymous_sign_ins = true` を確認
  - `npm run db:local:stop && npm run db:local:start` で再起動

## 8. （任意）旧初期サンプル4問を投入

```bash
npm run db:local:seed:legacy-samples:dry
npm run db:local:seed:legacy-samples
```

## 9. （任意）Storage正本から問題同期

手順は `docs/content_sync.md` を参照してください。  
（`npm run content:validate` -> `npm run content:sync:dry` -> `npm run content:sync`）

dev専用のテスト問題だけを登録したい場合も、`docs/content_sync.md` の  
「dev専用テスト問題を登録する手順（prod非反映）」を参照してください。

## 10. 日常利用の最短手順（2回目以降）

最短は以下の2コマンドです。

```bash
npm run dev:up
# 停止時
npm run dev:down
```

個別に実行する場合:

```bash
npm run db:local:start
npm run redis:local:start
npm run dev
```

新しいmigrationを追加した日だけ:

```bash
npm run db:local:migration:up
```

停止時:

```bash
npm run redis:local:stop
npm run db:local:stop
```

## 11. よくある失敗

- `401 Unauthorized`:
  - `.env.local` / `.env.content.local` の `UPSTASH_REDIS_REST_TOKEN` が `quizly-dev-token` と一致しているか確認
  - `curl` の `Authorization: Bearer ...` が同じ値か確認
- `Connection refused` / `Failed to fetch`:
  - `npm run redis:local:status` で `quizly-srh-local` が `Up` か確認
  - `docker ps` で 8079 ポート公開を確認
  - 既存プロセスと競合する場合は `npm run redis:local:stop` 後に再起動
