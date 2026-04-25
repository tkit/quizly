# Migration Freeze and Inventory

最終更新: 2026-04-25  
対象Issue: #25 / 親Issue: #24

## 目的

Cloudflare + Clerk + D1 移行に入る前に、移行へ影響する現行契約を固定し、Supabase/Auth/RLS/RPC/Upstash/Storage の依存を棚卸しする。

## Freeze Rules

移行計画中は、以下の変更を原則 freeze する。

| 領域 | freeze 対象 | 例外条件 |
|---|---|---|
| DB schema | `supabase/migrations` のテーブル、制約、index、function、policy | P0/P1 障害修正、データ保全に必要な修正 |
| Auth contract | Supabase Auth の provider、callback、cookie、`auth.uid()` 前提 | セキュリティ修正、OAuth 設定の運用修正 |
| RLS/Authz | household boundary、policy、API の ownership check | cross-household access を防ぐ修正 |
| RPC | `complete_study_session`, `get_active_question_counts`, `get_child_study_status` の入出力 | 互換性を保つ内部修正 |
| Cache/lock | `quizly:*` Redis key、TTL、idempotency、lockout semantics | 既存キー不整合や障害修正 |
| Storage/content | `quiz-content`, `quiz-images`, `image_url` の意味、content sync format | 問題データの運用修正 |
| Deploy/env | GitHub Actions、Vercel env、Supabase env、Upstash env | 移行準備に必要な追加のみ |

## Exception Process

1. 変更者は PR/Issue に `migration-freeze-exception` として理由、影響領域、rollback 方法を記録する。
2. 影響領域の owner が review し、互換性維持または後続Issueへの反映を確認する。
3. `docs/migration_inventory.md` と関連正本ドキュメントを同じ PR で更新する。
4. DB/Auth/Cache の runtime contract を変える場合は、移行リハーサル (#33) の検証項目へ追加する。

## Owners

| 領域 | Owner | 正本/主な参照 |
|---|---|---|
| Runtime/deploy | App owner | `.github/workflows/deploy.yml`, `docs/operations_prod.md` |
| Auth/session | App owner | `docs/auth_spec.md`, `src/lib/auth/*`, `proxy.ts` |
| DB/schema/RLS/RPC | App owner | `supabase/migrations`, `docs/db_schema.md` |
| Cache/lock/counters | App owner | `src/lib/cache/upstash.ts`, `docs/cache_key_conventions.md` |
| Content/storage | App owner | `docs/content_sync.md`, `scripts/content-sync.mjs`, `src/lib/content/imageUrl.ts` |
| Cutover/runbook | App owner | #33, #34, #35 |

## Inventory Summary

| 種別 | 現行依存 | 移行先Issue | 備考 |
|---|---|---|---|
| Runtime | Vercel + Next.js App Router | #26 | `next.config.ts` は Supabase Storage host を画像許可へ追加 |
| Auth | Supabase Auth, `@supabase/ssr`, Google OIDC, Magic Link, Passkey, anonymous dev shortcut | #27 | Clerk user id mapping が必要 |
| DB | Supabase Postgres | #28 | D1 schema へ変換 |
| RPC | Supabase SQL functions 3系統 | #29 | app/service layer transaction へ移す |
| Authz | Supabase RLS + 一部 API-side checks | #30 | D1 では app-layer guards が正本 |
| Cache/lock | Upstash Redis REST | #31 | KV と Durable Objects に責務分割 |
| Storage | Supabase Storage public/private buckets | #32 | R2 へ移行 |
| Migration/rehearsal | Supabase CLI, content sync scripts, GitHub Actions | #33-#35 | rehearsal/cutover で証跡化 |

## Runtime and Env Inventory

| 変数/設定 | 利用箇所 | 用途 | 移行時の扱い |
|---|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | `src/app/layout.tsx` | canonical/OGP URL | Cloudflare domain へ更新 |
| `NEXT_PUBLIC_SUPABASE_URL` | auth clients, Storage URL, scripts, workflows | Supabase API/Storage 接続 | Clerk/D1/R2 移行で段階削除 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser/server/proxy Supabase clients | Supabase Auth/session/RLS | Clerk 移行で削除 |
| `SUPABASE_SECRET_KEY` | content/seed/upload scripts | service-role write | D1/R2 用 secret へ置換 |
| `SUPABASE_PROJECT_ID` | `scripts/supabase-cli.sh`, deploy workflow | prod migration target | D1 移行後に削除 |
| `SUPABASE_ACCESS_TOKEN` | `scripts/supabase-cli.sh`, deploy workflow | Supabase CLI auth | D1 移行後に削除 |
| `NEXT_PUBLIC_QUESTION_IMAGE_BUCKET` | `src/lib/content/imageUrl.ts` | public image bucket | R2 bucket/base URL へ置換 |
| `CONTENT_BUCKET` | content/upload scripts | content JSON bucket | R2 object path へ置換 |
| `QUESTION_IMAGE_BUCKET` | upload dev test script | local/dev image upload | R2 bucket へ置換 |
| `UPSTASH_REDIS_REST_URL` | cache helper, content sync, workflows | Redis REST endpoint | KV/DO binding へ置換 |
| `UPSTASH_REDIS_REST_TOKEN` | cache helper, content sync, workflows | Redis REST token | KV/DO binding へ置換 |
| `NEXT_PUBLIC_AUTH_MODE` | `src/lib/auth/constants.ts` | dev shortcut gating | Clerk移行後も環境判定として再評価 |
| `NEXT_PUBLIC_ENABLE_DEV_AUTH_SHORTCUT` | `src/lib/auth/constants.ts` | anonymous dev login gating | production false を維持 |

## Auth and Session Inventory

| Contract | 現行実装 | 移行時の注意 |
|---|---|---|
| Parent session | Supabase Auth cookie via `createServerClient` | Clerk session verification に置換 |
| Auth middleware | `proxy.ts` -> `src/lib/auth/proxy.ts` -> `supabase.auth.getUser()` | Clerk middleware/session helper へ置換 |
| Browser auth | `src/lib/auth/browser.ts`, `HomeClient.tsx`, dashboard/parent signOut | Clerk UI/API へ置換 |
| OAuth callback | `src/app/auth/callback/route.ts` | Clerk callback route に置換 |
| Child session | `quizly_active_child` httpOnly cookie | 維持。ただし guardian id は Clerk id へ |
| Parent reauth | Redis TTL + DB fallback `parent_reauth_challenges` | DO または D1 fallback の責務を #31/#30 で決定 |
| Dev shortcut | Supabase anonymous sign-in | Clerk 移行時に廃止または dev-only 代替を明文化 |

## DB Schema Inventory

現行 schema の正本は `supabase/migrations`。

| テーブル/オブジェクト | 主用途 | 移行先Issue | 注意 |
|---|---|---|---|
| `guardian_accounts` | 保護者プロフィール、PIN hash | #27/#28/#30 | `id` は現行 `auth.users.id` |
| `child_profiles` | 子プロフィール、total points | #28/#30 | `guardian_id` で household boundary |
| `parent_reauth_challenges` | Redis fallback の再認証TTL | #31 | DO/D1 どちらへ残すか要判断 |
| `genres`, `questions` | 学習カタログ、問題 | #28/#32 | `questions.image_url` は Storage/R2 key |
| `study_sessions`, `study_history` | 学習完了と履歴 | #28/#29/#30 | quiz completion の中核 |
| `point_transactions` | point 付与履歴 | #28/#29 | RPC と整合 |
| `child_daily_point_state` | daily/streak bonus state | #28/#29 | session complete と同一整合性が必要 |
| `badge_definitions`, `child_badges`, `badge_unlock_events`, `child_streak_state` | badge/streak | #28/#29/#30 | unlock は transaction parity が必要 |
| `child_learning_stats`, `child_genre_progress`, `child_subject_stats` | 集計高速化 | #28/#29 | `complete_study_session` で更新 |

## RPC Inventory

| RPC | 呼び出し箇所 | 責務 | 移行先 |
|---|---|---|---|
| `complete_study_session` | `src/app/api/study-sessions/complete/route.ts` | session/history/points/badges/stats/streak をまとめて更新 | #29 |
| `get_active_question_counts` | `src/lib/auth/data.ts` | dashboard catalog の active question count | #29 |
| `get_child_study_status` | `src/lib/auth/data.ts` | active child の genre progress/status | #29 |

## RLS/Authz Inventory

| テーブル群 | 現行境界 | 移行先 |
|---|---|---|
| guardian owned | `guardian_accounts.id = auth.uid()`, `child_profiles.guardian_id = auth.uid()` | API/service guard |
| child owned learning data | `child_id -> child_profiles.guardian_id = auth.uid()` | shared authz helper |
| public catalog | `genres`, `questions`, `badge_definitions` read-all | public/read-only service |
| derived stats/badges | `child_id -> guardian_id` | shared authz helper |

RLS は D1 へ直接移植できないため、#30 で「guardian が child を所有する」チェックを共通化し、全 protected API に negative tests を追加する。

## Cache and Lock Inventory

| Key | 実装 | TTL/意味 | 移行先 |
|---|---|---|---|
| `quizly:parent_reauth:session:<guardian_id>` | `src/lib/auth/parentReauth.ts` | 15分、親管理 unlock | DO または KV |
| `quizly:parent_reauth:attempts:guardian:<guardian_id>` | `src/lib/auth/parentReauth.ts` | 10分窓、PIN失敗回数 | DO |
| `quizly:parent_reauth:attempts:ip:<ip_hash>` | `src/lib/auth/parentReauth.ts` | 10分窓、IP失敗回数 | DO |
| `quizly:parent_reauth:cooldown:<guardian_id>` | `src/lib/auth/parentReauth.ts` | 5分、lockout | DO |
| `quizly:parent_snapshot:v1:<guardian_id>` | `src/lib/auth/data.ts` | 5分、parent page snapshot | KV |
| `quizly:dashboard:catalog:v2` | `src/lib/auth/data.ts`, `scripts/content-sync.mjs` | 10分、catalog cache | KV |
| `quizly:quiz_order_version:v1:<genre_id>` | `src/lib/quiz/questionSet.ts`, `scripts/content-sync.mjs` | content sync 後に INCR | KV または DO |
| `quizly:quiz_question_set:v1:<genre_id>:<child_id>:<count>:v<genre_version>` | `src/lib/quiz/questionSet.ts` | 10分、出題セット | KV |
| `quizly:result_session:v1:<guardian_id>:<session_id>` | `src/lib/result/sessionResult.ts` | 5分、result snapshot | KV |
| `quizly:study_session_complete:idempotency:v1:<guardian_id>:<child_id>:<idempotency_key>` | `src/app/api/study-sessions/complete/route.ts` | 60分、二重送信抑止 | DO 推奨 |
| `quizly:badge_overview:overview:v1:<child_id>` | `src/lib/badges/overview.ts` | 60秒、badge overview | KV |
| `quizly:badge_overview:summary:v1:<child_id>` | `src/lib/badges/overview.ts` | 60秒、badge summary | KV |

## Storage and Content Inventory

| Contract | 現行実装 | 移行時の注意 |
|---|---|---|
| Content JSON | private `CONTENT_BUCKET` / `quiz-content`; `scripts/content-sync.mjs` が download | R2 private object + auth 付き worker/script |
| Question images | public `NEXT_PUBLIC_QUESTION_IMAGE_BUCKET` / `quiz-images`; `src/lib/content/imageUrl.ts` が public URL 生成 | R2 public/custom domain URL へ置換 |
| `questions.image_url` | bucket 内 object key として保存 | URL ではなく key として継続するのが安全 |
| Upload helpers | `scripts/upload-content-object.mjs`, `scripts/upload-dev-test-content.mjs` | R2 upload helper に置換 |
| Cache invalidation | content sync 後に dashboard/quiz order keys を invalidation | KV/DO 版へ置換 |

## Risk Register

| ID | Risk | Impact | Owner | Mitigation |
|---|---|---|---|---|
| R1 | Supabase user id と Clerk user id の対応漏れ | 既存ユーザーが学習データへアクセス不能 | Auth/session | #27 で mapping strategy を決め、rehearsal データで検証 |
| R2 | RLS 前提の API が app-layer guard へ移植漏れ | cross-household access | Authz/DB | #30 で protected API 一覧と negative tests を追加 |
| R3 | `complete_study_session` の transaction parity 不足 | point/badge/stats の不整合 | DB/RPC | #29 で idempotency と rollback/restore を含む service 化 |
| R4 | Redis atomic semantics を KV へ誤移植 | lockout/cooldown/idempotency が壊れる | Cache | #31 で atomic counter/lock は Durable Objects に寄せる |
| R5 | Storage URL/key の扱いを混同 | 画像表示、content sync が壊れる | Storage | #32 で `image_url` は object key として移行し、URL生成を単一化 |
| R6 | Migration/cutover 中の schema drift | rehearsal と本番の差分増加 | Cutover | freeze rules と exception process を運用 |
| R7 | Supabase service-role scripts が残存 | 移行後も旧基盤に書き込みうる | Runtime/deploy | #33/#34 で secrets と workflows の removal checklist を確認 |

## Sign-off Checklist

- [x] Freeze rules and exception process are documented.
- [x] Supabase/Auth/RLS/RPC dependencies are inventoried.
- [x] Upstash Redis key usages are inventoried.
- [x] Storage/content dependencies are inventoried.
- [x] Risk register and owner per domain are recorded.
- [ ] Issue #25 is reviewed and closed after PR/merge.
