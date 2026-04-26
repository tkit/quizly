# Clerk Migration

最終更新: 2026-04-26  
対象Issue: #27 / 親Issue: #24

## 方針

Cloudflare migration branch では Supabase Auth を使わず、Clerk を保護者ログインの正本にする。現行本番の Vercel/Supabase 構成は `main` で維持し、#34 の cutover までこの変更は本番へ merge しない。

## Runtime Contract

| 項目 | 方針 |
|---|---|
| Provider | Clerk |
| Sign-in UI | App button starts Clerk `oauth_google` redirect |
| Enabled identity provider | Google OAuth |
| OAuth callback page | `/sso-callback` |
| Server verification | `auth()` / `currentUser()` from `@clerk/nextjs/server` |
| Middleware | `clerkMiddleware()` in `src/middleware.ts` |
| App user id | `clerk_user_id` |
| Legacy user id | `supabase_user_id` retained only for backfill and audit |

## Middleware Compatibility Note

Next.js 16 recommends `proxy.ts` over `middleware.ts`, but this migration currently uses `src/middleware.ts` for Cloudflare/OpenNext compatibility.

Observed during #27:

| File | Result |
|---|---|
| `proxy.ts` at repository root | OpenNext build/deploy succeeded, but Clerk could not detect `clerkMiddleware()` at runtime on Cloudflare and `/` returned 500. |
| `src/proxy.ts` | Clerk detection matched the `src` layout, but OpenNext build failed with `Node.js middleware is not currently supported`. |
| `src/middleware.ts` | Next emitted a deprecation warning, but OpenNext build/deploy succeeded and Clerk session detection worked on `https://quizly.stdy.workers.dev/`. |

This appears related to Next.js issue [vercel/next.js#86122](https://github.com/vercel/next.js/issues/86122), where `proxy.ts` behavior differs under Cloudflare Proxy while `middleware.ts` continues to run. Keep `src/middleware.ts` until Next/OpenNext/Clerk compatibility makes `proxy.ts` safe on Cloudflare.

## User ID Mapping

New Cloudflare-side records use Clerk user ids as the canonical guardian id.

Existing Supabase users are mapped during migration by retaining the old Supabase auth user id as `supabase_user_id`. During #28/#29 data migration, guardian and child-owned tables should be backfilled so each household has:

| Field | Meaning |
|---|---|
| `clerk_user_id` | Canonical id for all new auth/session checks |
| `supabase_user_id` | Legacy id used to join/import historical Supabase data |

The application reads `publicMetadata.supabase_user_id` from Clerk as `legacySupabaseUserId` only to support migration logic. Authorization should always use the authenticated Clerk user id, not client-supplied ids or metadata from the browser.

## Environment

#27 uses a Clerk Development instance for the separated Cloudflare staging smoke test. Production instance creation is intentionally out of scope for #27.

| Issue | Clerk instance scope |
|---|---|
| #27 | Use Development instance keys (`pk_test_...`, `sk_test_...`) for `https://quizly.stdy.workers.dev/` staging auth smoke. Google SSO can use Clerk shared development credentials, so Google Cloud callback URL setup is not required here. |
| #33 | Rehearse and document the Production instance setup: Google OAuth custom credentials, Clerk-provided authorized redirect URI, production keys, env swap, validation, and rollback notes. Do not switch production traffic yet. |
| #34 | Execute production cutover using the Clerk Production instance and live keys (`pk_live_...`, `sk_live_...`). |

GitHub Environment `Preview`:

| Variable/Secret | Type |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | variable or secret |
| `CLERK_SECRET_KEY` | secret |

Cloudflare Worker `quizly`:

| Variable/Secret | Type |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | variable |
| `CLERK_SECRET_KEY` | secret |

`NEXT_PUBLIC_SITE_URL` remains `https://quizly.stdy.workers.dev`.

## Current Limitation

#27 proves Clerk sign-in/session integration. Child profiles, parent settings, quiz completion, and history still depend on the legacy Supabase DB paths until #28-#30 replace them with D1 and app-layer guards. Because the migration branch intentionally does not add Supabase secrets to Cloudflare, signing in with Clerk alone does not make every app flow fully functional yet.
