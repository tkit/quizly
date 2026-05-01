# Production Cutover Runbook

最終更新: 2026-05-01

## Scope

#34 は production traffic を Cloudflare stack に切り替える作業です。切替前に Cloudflare production resources を作成し、D1/R2 の import と validation を完了させます。

Target URL:

- `https://quizly.stdy.workers.dev`

## Production Resources

| Resource | Name | Status |
| :--- | :--- | :--- |
| Worker | `quizly` | Existing Worker service |
| D1 | `quizly` | Created, id `d745fb7e-302f-41ba-9d60-91b69944313d` |
| R2 question images | `quizly-question-images` | Created |
| R2 content JSON | `quizly-content` | Created |
| Clerk | Production instance | Manual setup required before deploy |

## Required Secrets And Vars

GitHub `Production` environment:

- `CLOUDFLARE_API_TOKEN` secret
- `CLOUDFLARE_ACCOUNT_ID` secret
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` variable or secret with `pk_live_...`
- `CLERK_SECRET_KEY` secret with `sk_live_...`

Cloudflare Worker `quizly`:

- `CLERK_SECRET_KEY` secret with `sk_live_...`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` variable with `pk_live_...`
- `NEXT_PUBLIC_SITE_URL=https://quizly.stdy.workers.dev`
- `NEXT_PUBLIC_AUTH_MODE=production`
- `NEXT_PUBLIC_ENABLE_DEV_AUTH_SHORTCUT=false`

Use `wrangler secret put CLERK_SECRET_KEY` only after the Clerk Production instance is ready. Keep the current test key available until rollback is no longer needed.

## Clerk Production Setup

1. Create or switch to the Clerk Production instance for Quizly.
2. Configure allowed origins / app URL / redirect settings for:
   - `https://quizly.stdy.workers.dev`
   - `https://quizly.stdy.workers.dev/sso-callback`
3. Configure Google OAuth in Clerk Production with custom Google credentials.
4. Copy the Clerk-provided Authorized Redirect URI from the Clerk Google provider settings.
5. Add that Clerk-provided URI to Google Cloud Console as an Authorized redirect URI.
6. Record the live publishable/secret keys in GitHub `Production` and Cloudflare Worker `quizly`.

Do not use `/sso-callback` as the Google Cloud redirect URI unless Clerk explicitly shows that exact URL.

## Data Preparation Executed

Executed on 2026-05-01:

```bash
./node_modules/.bin/wrangler d1 create quizly
./node_modules/.bin/wrangler r2 bucket create quizly-question-images
./node_modules/.bin/wrangler r2 bucket create quizly-content
./node_modules/.bin/wrangler d1 execute quizly --remote --file d1/migrations/0001_initial_schema.sql
./node_modules/.bin/wrangler d1 execute quizly --remote --file d1/migrations/0002_cloudflare_state_tables.sql
npm run r2:upload:question-images:production
CONTENT_FIXTURE_DIR=.content-sync npm run d1:seed:reference:production
CONTENT_FIXTURE_DIR=.content-sync npm run d1:validate:reference:production
```

Content objects uploaded to `quizly-content`:

- `content/japanese/grammar.json`
- `content/math/ueki-shuki.json`
- `content/science/space.json`
- `content/science/biology-01.json`
- `content/science/biology-02.json`
- `content/social/geo-01.json`
- `content/social/geo-02.json`

Validation output:

| Check | Result |
| :--- | :--- |
| fixture files | 7 |
| genres | expected 33 / actual 33 |
| questions | expected 560 / actual 560 |
| badge definitions | 42 |
| invalid genre parent references | 0 |
| invalid question genre references | 0 |
| media references | 0 |
| genre hash | `a6a1b0d4718bbe09ad56d7a9edbbe6f69591eaf7cf0ac6ad0e3084d60165ca97` |
| question hash | `b8000bfb71b745aae65cb95ca4c15770221ecfe0056d782f29f537f2e1b9539c` |

## Deployment Steps

1. Confirm Clerk Production and Google OAuth setup is complete.
2. Confirm GitHub `Production` environment has the required secrets and vars.
3. Confirm Cloudflare Worker `quizly` has the required live Clerk secret and vars.
4. Run `Cloudflare Production` workflow with `deploy=false`.
5. If build/lint/typecheck pass, run `Cloudflare Production` workflow with `deploy=true`.
6. Smoke test `https://quizly.stdy.workers.dev`.

Manual fallback command:

```bash
npm run cf:build:production
npm run cf:deploy-built:production
```

## Post-Deploy Smoke Test

- Sign in with Google via Clerk Production.
- Create or select a child profile.
- Open dashboard.
- Start and complete a quiz.
- Confirm points/badges/streaks update.
- Open history.
- Run parent re-auth.
- Confirm media delivery for any question with `image_url`.

## Rollback

- If deploy has not happened yet, stop and keep the current Worker version.
- If deploy happened and auth fails, restore the previous Worker version from Cloudflare deployments or reset Clerk env values to the previous test pair and redeploy.
- Keep `quizly-staging`, `quizly-rehearsal-20260501`, and Clerk test keys until #35 monitoring is complete.
