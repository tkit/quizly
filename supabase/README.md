# Supabase Migrations

`supabase/migrations` is the source of truth for database changes.

## Environment Split

- `dev`: local Supabase stack (`supabase start`)
- `prod`: remote Supabase project

## CLI Environment

Store CLI-only credentials in `.env.supabase.local` at repo root:

```bash
SUPABASE_PROJECT_ID=<project-ref>
SUPABASE_ACCESS_TOKEN=<personal-access-token>
```

`db:prod:*` scripts auto-load `.env.supabase.local`.
`db:local:*` scripts never target the remote project.

Prod-targeted scripts are blocked unless `ALLOW_SUPABASE_PROD=1` is set.

## Common Commands

```bash
npm run db:local:start
npm run db:local:migration:up
npm run db:local:status

npm run db:migration:new -- add_some_change

npm run db:prod:migration:up
npm run db:prod:status
```

## Active migrations

- `20260320000000_baseline_schema.sql`

This baseline represents the current schema and seed state.

## Rules

- Add new DB changes as new migration files (append-only).
- Do not edit historical migration files after they have been applied.
- Do not make direct schema changes from Supabase SQL Editor for normal development.
- Prefer running prod migrations only from CI release workflow.
