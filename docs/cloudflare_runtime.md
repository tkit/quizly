# Cloudflare Runtime Bootstrap

最終更新: 2026-04-26  
対象Issue: #26-#27 / 親Issue: #24

## 目的

Quizly の Next.js runtime を Cloudflare Workers 上で smoke test できる状態にする。現行本番は `main` の Vercel/Supabase/Upstash 構成で独立稼働させ、Cloudflare 移行は `codex/cloudflare-migration` の長命ブランチ上で完全分離して育てる。

DB/Auth/Storage/Redis の本格移行は後続Issueで扱うため、この段階では Supabase/Upstash の preview secrets を新規追加しない。#26 は OpenNext + Workers の起動確認と、後続 #27-#32 を積む分離デプロイ経路の確立に絞る。

分離方針の正本は `docs/migration_inventory.md` の "Migration Branch Strategy"。#26-#32 は `codex/cloudflare-migration` と `quizly.stdy.workers.dev` で完結させ、#33 の rehearsal まで現行本番 `main` へ merge しない。#34 の maintenance window が、本番昇格と merge/deploy の境界になる。

## 構成

| 項目 | 値 |
|---|---|
| Adapter | `@opennextjs/cloudflare` |
| Deploy CLI | `wrangler` |
| Worker entry | `.open-next/worker.js` |
| Static assets binding | `ASSETS` |
| Staging worker | `quizly` |
| Staging URL policy | `https://quizly.stdy.workers.dev/` を Cloudflare migration smoke URL とする |
| Migration branch | `codex/cloudflare-migration` |

`wrangler.toml` は production 相当の `quizly` と Cloudflare preview 用の `env.staging` を定義する。Wrangler の環境名は `staging` のまま使うが、GitHub Actions の Environment は既存の `Preview` を使う。#26 では preview を主対象にし、production cutover は #34 まで実施しない。

## Local Commands

```bash
npm run cf:build
npm run cf:build:staging
npm run cf:preview
npm run cf:deploy:staging
npm run cf:deploy-built:staging
npm run cf-typegen
```

`npm run cf:preview` は Workers runtime (`workerd`) でのローカル確認用。通常の開発は引き続き `npm run dev` を使う。

`cf:build*` と `cf:deploy:staging` は `scripts/cloudflare-migration-build-env.mjs` 経由で実行する。この wrapper は migration branch の Cloudflare build に Supabase/Upstash のローカル環境変数を混ぜないため、`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `UPSTASH_REDIS_REST_*` を build process から削除する。

## GitHub Actions

対象Workflow: `.github/workflows/cloudflare-preview.yml`

手動実行入力:

| input | 意味 |
|---|---|
| `deploy=false` | lint/typecheck/OpenNext build まで実行 |
| `deploy=true` | build 成功後、Cloudflare preview Worker へ deploy |

必要な GitHub Environment `Preview` secrets:

| Secret | 用途 |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Wrangler deploy |
| `CLOUDFLARE_ACCOUNT_ID` | Wrangler deploy |
| `CLERK_SECRET_KEY` | Clerk server-side session verification |

必要な GitHub Environment `Preview` variables または secrets:

| Variable/Secret | 用途 |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk browser SDK initialization |

Cloudflare Worker 側にも、Supabase/Upstash の runtime variables/secrets は追加しない。#27 以降は Clerk の runtime variables/secrets だけを追加する。`wrangler deploy` は `--keep-vars` 付きで実行し、Dashboard/Workers Builds 側で管理している値を削除しない。

| Worker runtime variable/secret | 用途 |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | staging URL。`wrangler.toml` では `https://quizly.stdy.workers.dev` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk browser SDK initialization |
| `CLERK_SECRET_KEY` | Clerk server-side session verification |
| `NEXT_PUBLIC_AUTH_MODE` | `production` |
| `NEXT_PUBLIC_ENABLE_DEV_AUTH_SHORTCUT` | `false` |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | `/` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | `/` |

Clerk の Google OAuth callback/redirect は Clerk Dashboard で `https://quizly.stdy.workers.dev/` と `https://quizly.stdy.workers.dev/sso-callback` を許可する。Cloudflare 側では `CLERK_SECRET_KEY` を secret、`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` を variable として登録する。

## Cloudflare Dashboard / Builds

Workers Builds を使う場合の設定:

| 項目 | 値 |
|---|---|
| Git repository | `tkit/quizly` |
| Production branch | `codex/cloudflare-migration` |
| Build command | `npm ci && npm run cf:build:staging` |
| Deploy command | `npm run cf:deploy-built:staging` |
| Worker environment | `staging` |

手動Workflowを使う場合は、Cloudflare 側の `quizly` Worker を `quizly.stdy.workers.dev` で smoke する。`fruits-drill.com` は廃止予定なので、custom domain/route には使わない。

## Smoke Checklist

- [ ] `npm run cf:build:staging` が成功する。
- [ ] Cloudflare preview deploy が成功する。
- [ ] `https://quizly.stdy.workers.dev/api/health` が 200 と `{ "ok": true }` を返す。
- [ ] `https://quizly.stdy.workers.dev/` が 200 を返す。
- [ ] `https://quizly.stdy.workers.dev/` から Clerk Google sign-in が開始でき、ログイン後 `/` へ戻る。
- [ ] Supabase/Upstash 未移行箇所は後続Issueの対象として残し、Cloudflare 側へ legacy secrets を足さない。

## Follow-up Boundaries

- Clerk 移行は #27。
- D1 schema と SQL/RPC 移行は #28/#29。
- RLS 相当の app-layer guard は #30。
- KV/Durable Objects への Redis 置換は #31。
- R2 への Storage 移行は #32。
