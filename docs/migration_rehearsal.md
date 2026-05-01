# Migration Rehearsal Report

最終更新: 2026-05-01

## Scope

#33 は production traffic を切り替えずに、Cloudflare stack が production-like input から再構築できることを確認する rehearsal です。cutover 実行は #34 で扱います。

## Current Staging Baseline

| Area | Status | Notes |
| :--- | :--- | :--- |
| Runtime | Verified | `quizly.stdy.workers.dev` is served by Cloudflare Workers. |
| Auth | Verified for staging | Clerk development instance is configured for staging. Clerk Production rehearsal remains open. |
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

## Rehearsal Commands

```bash
npm run d1:schema:verify
npm run r2:download:content:staging
npm run r2:upload:question-images:staging
npm run d1:migrate:question-image-paths:staging
npm run d1:seed:reference:staging
npm run cf:build:staging
npm run cf:deploy-built:staging
```

GitHub Actions:

- `Cloudflare Preview`: build/deploy staging Worker.
- `Cloudflare Content Update`: upload R2 images, download content JSON from R2, migrate image paths, optionally seed D1 reference data.

## Validation Checklist

- [ ] Create/recreate rehearsal D1 from migrations.
- [ ] Import reference data from the selected canonical content source.
- [ ] Validate table counts and foreign keys.
- [ ] Validate media path references against R2 objects.
- [ ] Verify sign-in.
- [ ] Verify child selection.
- [ ] Verify dashboard.
- [ ] Verify quiz start.
- [ ] Verify study completion.
- [ ] Verify points, badges, and streaks.
- [ ] Verify history.
- [ ] Verify parent management and parent re-auth.
- [ ] Verify media delivery.
- [ ] Document runtime duration and recovery steps.

## Clerk Production Rehearsal

Before #34, prepare and record:

- Production instance creation timing.
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...` owner and target environment.
- `CLERK_SECRET_KEY=sk_live_...` owner and target environment.
- Google OAuth credentials for Clerk Production.
- Clerk-provided Authorized Redirect URI registered in Google Cloud Platform.
- Rollback plan back to current production if cutover validation fails.

Do not switch production traffic in #33.

## Current Open Items

- Create and document the staging content R2 bucket/object naming convention.
- Run a fresh rehearsal D1 rebuild/import instead of reusing the current staging database.
- Record row counts/hashes after import.
- Prepare Clerk Production instance steps and Google OAuth callback evidence.
