# SaaS Decommission Checklist

Quizly is now served from Cloudflare Workers, D1, and R2 at `https://quizly.stdy.workers.dev`.
Use this checklist before deleting or disconnecting old external services.

## Vercel

- [ ] Disable the Vercel GitHub integration for `tkit/quizly`, or delete the old Vercel project if it is no longer needed.
- [ ] Confirm new pull requests no longer receive Vercel preview deployment checks or Vercel bot comments.
- [ ] Remove any Vercel project environment variables after the project is disconnected or deleted.

## Supabase

- [ ] Keep a final export or backup until the migrated D1 data has been checked in production.
- [ ] Confirm no GitHub, Cloudflare, or local runtime configuration still depends on `SUPABASE_*`.
- [ ] Delete the old Supabase project after the retention window is over.
- [ ] Delete local `.env.supabase.local` after the Supabase project is no longer needed.

## Upstash

- [ ] Confirm no GitHub, Cloudflare, or local runtime configuration still depends on `UPSTASH_*` or `REDIS_*`.
- [ ] Delete the old Upstash Redis database after production smoke checks are complete.

## Migration Artifacts

- [ ] Keep `.legacy-supabase-export/` outside git until the retention window is over.
- [ ] Remove legacy learning import scripts and migration notes after the final backup/retention decision.
- [ ] Keep Cloudflare content update scripts and workflows; they are part of normal R2-to-D1 operations.
