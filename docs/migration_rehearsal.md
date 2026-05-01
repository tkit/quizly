# Migration Rehearsal Report

最終更新: 2026-05-01

## Scope

#33 は production traffic を切り替えずに、Cloudflare stack が production-like input から再構築できることを確認する rehearsal です。cutover 実行は #34 で扱います。

## Current Staging Baseline

| Area | Status | Notes |
| :--- | :--- | :--- |
| Runtime | Verified | `quizly.stdy.workers.dev` is served by Cloudflare Workers. |
| Auth | Verified for staging | Clerk development instance is configured for staging. Clerk Production setup is documented below for #34. |
| DB | Verified | D1 `quizly-staging` is bound as `DB`. App flows no longer use legacy DB clients. |
| State / idempotency | Verified | D1 tables handle parent PIN cooldown and study completion idempotency. |
| Media | Verified | R2 `quizly-question-images-staging` is bound as `QUESTION_IMAGES`; sample images return HTTP 200. |
| Legacy dependency scan | Verified | Runtime code no longer references legacy DB/storage/cache clients. |

## Rehearsal Inputs

| Input | Current Source | #33 Decision |
| :--- | :--- | :--- |
| Schema | `d1/migrations/*.sql` | Use repo migrations. |
| Reference data | R2 content JSON | Store content JSON outside git and import it into D1 through GitHub Actions. |
| Question media | `assets/question-images/` | Use repo assets and upload to R2. |
| Clerk keys | GitHub Preview environment for staging | Create/prepare Clerk Production instance before #34. |

## Content Source Decision

The old manual content sync workflow depended on legacy storage and DB secrets, so it was removed. The replacement workflow is `Cloudflare Content Update`.

Decision: keep frequently updated question content outside the application repository. R2 is the canonical staging area for content JSON, and D1 is the runtime source of truth.

Operational flow:

1. An operator uploads content JSON to R2.
2. `Cloudflare Content Update` downloads the selected R2 object.
3. The workflow validates/imports the JSON through `scripts/d1-seed-reference-data.mjs`.
4. The app reads questions from D1 at runtime.

Current staging content bucket:

- `quizly-content-staging`

Current staging content objects:

- `content/japanese/grammar.json` (`genres=20`, `questions=450`)
- `content/math/ueki-shuki.json` (`genres=2`, `questions=15`)
- `content/science/space.json` (`genres=3`, `questions=35`)
- `content/science/biology-01.json` (`genres=1`, `questions=15`)
- `content/science/biology-02.json` (`genres=1`, `questions=15`)
- `content/social/geo-01.json` (`genres=1`, `questions=15`)
- `content/social/geo-02.json` (`genres=1`, `questions=15`)

`Cloudflare Content Update` imports one content object per run. This matches the expected operation where only changed content files are uploaded/imported. For a full rebuild rehearsal, run the workflow once for each object above.

R2 download check on 2026-05-01: all objects above were fetched from `quizly-content-staging` with `scripts/r2-download-content-object.mjs` and parsed as JSON successfully.

## Rehearsal Commands

```bash
npm run d1:schema:verify
npm run r2:download:content:staging
npm run r2:upload:question-images:staging
npm run d1:migrate:question-image-paths:staging
npm run d1:seed:reference:staging
npm run d1:validate:reference:staging
npm run cf:build:staging
npm run cf:deploy-built:staging
```

GitHub Actions:

- `Cloudflare Preview`: build/deploy staging Worker.
- `Cloudflare Content Update`: upload R2 images, download one content JSON object from R2, migrate image paths, optionally seed D1 reference data.

## Fresh D1 Rebuild Rehearsal

Executed on 2026-05-01 against a new remote D1 database:

- Database name: `quizly-rehearsal-20260501`
- Database id: `95d50b2b-dc5f-410c-bff2-8fd00547f67a`
- Region: APAC

Commands:

```bash
./node_modules/.bin/wrangler d1 create quizly-rehearsal-20260501
./node_modules/.bin/wrangler d1 execute quizly-rehearsal-20260501 --remote --file d1/migrations/0001_initial_schema.sql
./node_modules/.bin/wrangler d1 execute quizly-rehearsal-20260501 --remote --file d1/migrations/0002_cloudflare_state_tables.sql
D1_DATABASE_NAME=quizly-rehearsal-20260501 CONTENT_FIXTURE_DIR=.content-sync node scripts/d1-seed-reference-data.mjs
D1_DATABASE_NAME=quizly-rehearsal-20260501 CONTENT_FIXTURE_DIR=.content-sync npm run d1:validate:reference:staging
```

Runtime results:

| Step | Result |
| :--- | :--- |
| `0001_initial_schema.sql` | 36 queries, 11.74 ms, 19 tables |
| `0002_cloudflare_state_tables.sql` | 6 queries, 5.61 ms |
| reference seed | 636 queries, 72.03 ms |
| validation | passed |

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

Failure recovery:

- If R2 download fails, re-run the failed object download or re-run `Cloudflare Content Update` with the same `content_object_key`.
- If D1 migration fails, create a new rehearsal D1 and replay both migration files.
- If seed fails, keep the rehearsal DB for inspection and replay the seed after fixing the source JSON or seed script.
- If validation fails, compare the reported count/hash mismatch against `.content-sync` and the imported D1 rows before any cutover work.

## Validation Checklist

- [x] Create/recreate rehearsal D1 from migrations.
- [x] Import reference data from the selected canonical content source.
- [x] Validate table counts and foreign keys.
- [x] Validate media path references against R2 objects.
- [x] Verify sign-in on staging Worker.
- [x] Verify child selection on staging Worker.
- [x] Verify dashboard on staging Worker.
- [x] Verify quiz start on staging Worker.
- [x] Verify study completion on staging Worker.
- [x] Verify points, badges, and streaks on staging Worker.
- [x] Verify history on staging Worker.
- [x] Verify parent management and parent re-auth on staging Worker.
- [x] Verify media delivery on staging Worker.
- [x] Document runtime duration and recovery steps.

## Clerk Production Rehearsal

Do not switch production traffic in #33.

Create the Clerk Production instance either at the end of #33 or at the start of #34. The required setup for #34 is:

- Create or switch to a Clerk Production instance for Quizly.
- Configure the production app URL / allowed origin / redirect settings for `https://quizly.stdy.workers.dev/` and `https://quizly.stdy.workers.dev/sso-callback`.
- Create custom Google OAuth credentials for the Clerk Production instance.
- Copy the Clerk-provided Authorized Redirect URI from the Clerk Production Google provider settings.
- Register that Clerk-provided URI in Google Cloud Platform as an Authorized redirect URI. Do not use `/sso-callback` as the GCP redirect URI unless Clerk explicitly shows that exact URI.
- Store `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...` in the GitHub environment and Cloudflare Worker environment used for #34 cutover.
- Store `CLERK_SECRET_KEY=sk_live_...` in the GitHub environment and Cloudflare Worker secret used for #34 cutover.
- Keep the current staging `pk_test_...` / `sk_test_...` pair unchanged until #34 intentionally switches auth to live keys.

Rollback notes for #34:

- If live auth validation fails before traffic promotion, keep using the current staging Clerk development keys and do not promote.
- If validation fails after live keys are deployed, restore the previous Cloudflare Worker version or reset Clerk env values to the previous test pair, then redeploy.
- Do not delete the Clerk development instance or test keys during #33/#34.

## Current Open Items

- Production traffic cutover remains #34.
- Clerk Production instance creation and Google Cloud console changes remain manual operator steps for #34.
