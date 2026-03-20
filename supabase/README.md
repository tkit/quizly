# Supabase Migrations

`supabase/migrations` is the source of truth for database changes.

## CLI Environment

Store CLI-only credentials in `.env.supabase.local` at repo root:

```bash
SUPABASE_PROJECT_ID=<project-ref>
SUPABASE_ACCESS_TOKEN=<personal-access-token>
```

`npm run db:*` scripts auto-load `.env.supabase.local`.
If you run Supabase CLI directly, load them manually:

```bash
set -a
source .env.supabase.local
set +a
```

## Active migrations

- `20260320000000_baseline_schema.sql`

This baseline represents the current schema and seed state.

## Rules

- Add new DB changes as new migration files (append-only).
- Do not edit historical migration files after they have been applied.
- Do not make direct schema changes from Supabase SQL Editor for normal development.
