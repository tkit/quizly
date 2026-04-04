# 本番運用サマリ（Deploy / 外部設定）

最終更新: 2026-04-04

本書は **prod運用の正本** です。  
ローカル開発（dev）手順は `README.md` を参照してください。

## 1. 運用境界

- `README.md`: ローカル開発（dev）の起動・検証手順
- `docs/operations_prod.md`（本書）: 本番（prod）のデプロイ運用と外部設定

## 2. GitHub Actions 本番デプロイフロー

対象Workflow: `.github/workflows/deploy.yml`

トリガー条件:
- `CI` workflow が `success`
- `main` ブランチへの `push`
- `workflow_run` イベント

実行順（Migrate -> Deploy）:
1. Checkout target commit
2. Setup Node.js / Install dependencies
3. `Apply Supabase migrations (production)`
4. `vercel pull --environment=production`
5. `vercel build --prod`
6. `vercel deploy --prebuilt --prod`

失敗時挙動:
- migration が失敗した場合、後続の Vercel build/deploy は実行されません。
- これにより「DB未反映のまま新アプリを本番反映する」状態を防ぎます。

## 2-1. 問題コンテンツ同期（手動）

対象Workflow: `.github/workflows/content-sync.yml`

トリガー:
- GitHub Actions の `workflow_dispatch`（手動実行）

入力:
- `content_object_key`（既定: `japanese/grammar/content.json`）
- `apply_changes`（`false` なら dry-run のみ、`true` なら本反映）

実行順:
1. `content:validate`
2. `content:sync:dry`
3. `apply_changes=true` の場合のみ `content:sync`

用途:
- アプリの commit/push なしで、問題コンテンツだけを本番反映する。

## 3. 外部設定サマリ

| 設定先 | 項目 | 必須 | 用途 |
|---|---|---|---|
| GitHub Environment `production` secrets | `VERCEL_TOKEN` | 必須 | Vercel CLI 認証 |
| GitHub Environment `production` secrets | `VERCEL_ORG_ID` | 必須 | Vercel Project 解決 |
| GitHub Environment `production` secrets | `VERCEL_PROJECT_ID` | 必須 | Vercel Project 解決 |
| GitHub Environment `production` secrets | `SUPABASE_PROJECT_ID` | 必須 | prod Supabase migration 適用先 |
| GitHub Environment `production` secrets | `SUPABASE_ACCESS_TOKEN` | 必須 | Supabase CLI 認証 |
| GitHub Environment `production` secrets | `NEXT_PUBLIC_SUPABASE_URL` | 必須 | content-sync の接続先Supabase URL |
| GitHub Environment `production` secrets | `SUPABASE_SECRET_KEY` | 必須 | content-sync 実行権限（service role） |
| GitHub Environment `production` secrets | `CONTENT_BUCKET` | 必須 | content-sync 対象Storageバケット |
| Vercel Project Environment Variables（Production） | `NEXT_PUBLIC_SITE_URL` | 推奨 | OGP canonical など公開URL解決 |
| Vercel Project Environment Variables（Production） | `NEXT_PUBLIC_SUPABASE_URL` | 必須 | 本番Supabase接続先URL |
| Vercel Project Environment Variables（Production） | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 必須 | 本番Supabase anon key |
| Vercel Project Environment Variables（Production） | `NEXT_PUBLIC_AUTH_MODE=production` | 必須 | 開発ショートカット無効前提 |
| Vercel Project Environment Variables（Production） | `NEXT_PUBLIC_ENABLE_DEV_AUTH_SHORTCUT=false` | 必須 | 開発ショートカット無効化 |
| Vercel Project Environment Variables（Production） | `UPSTASH_REDIS_REST_URL` | 任意 | 親再認証/キャッシュでRedis利用時 |
| Vercel Project Environment Variables（Production） | `UPSTASH_REDIS_REST_TOKEN` | 任意 | 同上 |
| Supabase Auth 設定 | Site URL（本番URL） | 必須 | Auth callbackの正規遷移先 |
| Supabase Auth 設定 | Redirect URLs（本番 + localhost） | 必須 | Google OIDC / Magic Link callback許可 |
| Google Cloud OAuth Client | Authorized redirect URI（`https://<project-ref>.supabase.co/auth/v1/callback`） | 必須（Googleログイン使用時） | prodでGoogle OIDCを成立させる |
| Google Cloud OAuth Client | Authorized redirect URI（`http://localhost:54321/auth/v1/callback`） | 任意 | ローカルでGoogle OIDCを検証する場合のみ |
| Upstash Redis | Database / Token | 任意 | 親再認証TTL管理、content sync後のキャッシュ無効化 |

## 4. 運用メモ

- 本番DB変更は原則 GitHub Actions 経由で実施します（手元端末からのprod実行は通常運用外）。
- `content:sync` の正本手順は `docs/content_sync.md` を参照してください。
- 本番で `content:sync` を実行する場合は、Vercel側で `SUPABASE_SECRET_KEY` と `UPSTASH_REDIS_REST_*` の設定整合を確認してください。
- 認証・認可仕様の正本は `docs/auth_spec.md` です。本書は運用手順と設定棚卸しに特化しています。
