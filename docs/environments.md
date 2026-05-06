# Environments

最終更新: 2026-05-03

## 目的

Quizly は4つの実行環境を使い分ける。常用開発はローカルで行い、リモート staging は production deploy 前に Cloudflare Workers/D1/R2/Auth.js の結合を確認するためだけに使う。

| 環境 | コマンド / workflow | 目的 | URL |
| :--- | :--- | :--- | :--- |
| local dev | `npm run dev` | UI と通常開発。Cloudflare runtime の検証対象ではない。 | `http://localhost:3000` |
| local Cloudflare preview | `npm run cf:preview` | OpenNext/Workers 互換性をローカルで確認する。 | `http://localhost:8788` |
| remote staging | `npm run cf:deploy:staging` / GitHub Actions `Cloudflare Deploy` | production deploy 前の本番相当 smoke test。 | `https://quizly-staging.stdy.workers.dev` |
| remote production | `npm run cf:deploy:production` / GitHub Actions `Cloudflare Deploy` | 実運用環境。 | `https://quizly.stdy.workers.dev` |

## Release Flow

`main` 向け pull request が作成または更新されると、GitHub Actions `CI` が lint、typecheck、Next.js build を実行する。`CI` が成功すると GitHub Actions `Cloudflare Deploy` が同じ commit を checkout し、Cloudflare build と remote staging deploy を実行する。fork からの pull request は secrets を使えないため deploy せず、同じ repository 内の pull request だけを staging deploy 対象にする。

`main` に merge されると、GitHub Actions `CI` が lint、typecheck、Next.js build を実行する。`CI` が成功すると GitHub Actions `Cloudflare Deploy` が同じ commit を checkout し、production 用 Cloudflare build と remote production deploy を実行する。production deploy は `Production` environment の secrets を使う。手動 fallback も `Cloudflare Deploy` から実行し、`target` で `staging` または `production`、`deploy=true` を選んだ場合だけ deploy する。

Remote staging は共有環境のため、複数 pull request が並行している場合は最後に更新された pull request の内容で上書きされる。

## Cloudflare Resources

| 環境 | Worker | D1 | R2 question images | R2 content |
| :--- | :--- | :--- | :--- | :--- |
| staging | `quizly-staging` | `quizly-staging` | `quizly-question-images-staging` | `quizly-content-staging` |
| production | `quizly` | `quizly` | `quizly-question-images` | `quizly-content` |

`wrangler.toml` の top-level は production、`env.staging` は remote staging、`env.cloudflare-local` は local Cloudflare preview を表す。GitHub Actions の `Staging` environment は remote staging 用 secrets/vars の置き場として使う。

## Auth

認証は Auth.js Google OAuth と D1 database sessions を使う。Clerk の環境変数は使わない。

Google OAuth client は production と staging で共用する。Google Cloud Console の OAuth client に、次の authorized redirect URI を両方登録する。

```text
https://quizly.stdy.workers.dev/api/auth/callback/google
https://quizly-staging.stdy.workers.dev/api/auth/callback/google
```

`GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `AUTH_SECRET` は GitHub Actions environment ごとに secret として管理する。値は共用してもよいが、Staging environment の deploy は `quizly-staging` のみを更新する。

## Commands

日常的に使う Cloudflare 系コマンドは次の4つに絞る。

```bash
npm run cf:preview
npm run cf:deploy:staging
npm run cf:deploy:production
npm run cf:build:staging
```

`cf:deploy:<environment>:built` は GitHub Actions が build 済み artifact を deploy するための内部 script。手元から通常使わない。

Staging D1 migration は remote staging deploy 前に適用する。

```bash
npx wrangler d1 migrations apply quizly-staging --env staging --remote
```

Local Cloudflare preview 用の local D1 は `env.cloudflare-local` に対して次で準備する。

```bash
npm run d1:migrate:local
```

## Env Files

ローカルで使う env file は `.env.<environment>` 系に寄せる。

| ファイル | 用途 | commit |
| :--- | :--- | :--- |
| `.env.local` | `npm run dev` 用の個人設定。Next.js が読む。 | しない |
| `.env.local.example` | `npm run dev` 用テンプレート。 | する |
| `.env.cloudflare-local.local` | `npm run cf:preview` 用の個人 secrets。Wrangler `--env cloudflare-local` が読む。 | しない |
| `.env.cloudflare-local.example` | Cloudflare local preview 用テンプレート。 | する |
| `.env.staging.example` | remote staging 用 secrets/vars のチェックリスト。実値は GitHub Actions `Staging` environment / Cloudflare secrets に置く。 | する |
| `.env.production.example` | remote production 用 secrets/vars のチェックリスト。実値は GitHub Actions `Production` environment / Cloudflare secrets に置く。 | する |

Wrangler は `.env.<environment>` だけでなく `.env.local` もマージする。`.env.local` と Cloudflare local preview で同じ key の値が違う場合は、Wrangler の優先順位で最も強い `.env.cloudflare-local.local` に Cloudflare 用の値を書く。

## Staging Smoke Test

Remote staging deploy 後、production deploy 前に次を確認する。

- Google sign-in
- child selection
- dashboard
- quiz completion
- points, badges, streaks
- history
- parent re-auth
- media delivery via R2
