# D1 Schema Design

最終更新: 2026-04-27  
対象Issue: #28 / 親Issue: #24

## 目的

Cloudflare migration branch 上で、Quizly の D1 schema を再現可能な migration script として定義する。#28 は schema design までを扱い、service 化は #29、authorization guard は #30 で扱う。

## 成果物

| Path | 用途 |
|---|---|
| `d1/migrations/0001_initial_schema.sql` | D1 初期 schema。tables, constraints, indexes, key relationships を定義 |
| `d1/verify/schema_invariants.sql` | schema 適用後の基本検証クエリ |

ローカル検証:

```bash
npm run d1:schema:verify
```

Cloudflare D1 に適用する場合は、先に D1 database を作成して `wrangler.toml` に `d1_databases` binding を追加する。remote resource 作成は #28 の schema design には含めず、Cloudflare staging への実 binding は #29 でアプリ接続時に行う。

```bash
npx wrangler d1 create quizly-staging
```

作成後に出力された `database_id` を使って、staging env に binding を追加する。

```toml
[[env.staging.d1_databases]]
binding = "DB"
database_name = "quizly-staging"
database_id = "<database_id>"
migrations_dir = "d1/migrations"
```

schema 適用:

```bash
npx wrangler d1 migrations apply quizly-staging --env staging --remote
```

## D1 Rewrite Notes

| 元の設計要素 | D1/SQLite 方針 |
|---|---|
| `uuid`, `gen_random_uuid()` | `TEXT` id。D1 側の default は `lower(hex(randomblob(16)))`。Clerk user id は `guardian_accounts.id` にそのまま保存 |
| `auth.users(id)` FK | D1 には Auth schema がないため削除。`guardian_accounts.id` を Clerk canonical user id とする |
| `timestamptz`, `timestamp with time zone`, `date` | ISO-8601 text を保存。default は `CURRENT_TIMESTAMP` |
| `jsonb` | `TEXT CHECK (json_valid(...))` |
| `boolean` | `INTEGER CHECK (... IN (0, 1))` |
| RLS policies | D1 には移植しない。#30 で app-layer guard に置換 |
| SQL RPC (`complete_study_session`, `get_active_question_counts`, `get_child_study_status`) | D1 migration には関数を定義しない。#29 で TypeScript service + transaction へ置換 |
| `FILTER`, `DISTINCT ON`, PL/pgSQL, `FOR UPDATE`, `AT TIME ZONE` | #29 の service rewrite 対象 |
| `ON CONFLICT` | SQLite の `ON CONFLICT`/UPSERT へ置換可能。ただし service layer 側で明示する |

## Tables

| Table | D1 key design | Notes |
|---|---|---|
| `guardian_accounts` | `id TEXT PRIMARY KEY` | Clerk user id |
| `child_profiles` | random text id | `guardian_id` は Clerk id への FK |
| `parent_reauth_challenges` | random text id | #31 で Durable Objects/KV と責務再検討 |
| `genres` | `id TEXT PRIMARY KEY` | content taxonomy |
| `questions` | random text id | `options` は JSON text。Storage/R2 移行は #32 |
| `study_sessions` | random text id | completion transaction の中核。service 化は #29 |
| `study_history` | random text id | per-question answer history |
| `point_transactions` | random text id | points audit trail |
| `badge_definitions` | `key TEXT PRIMARY KEY` | reference data importは別途 seed/import 手順で扱う |
| `child_badges` | random text id + unique child/badge | unlocked badge state |
| `badge_unlock_events` | random text id | unlock audit trail |
| `child_streak_state` | `child_id` PK | streak and shield state |
| `child_daily_point_state` | `child_id` PK | daily challenge / consecutive correct state |
| `child_learning_stats` | `child_id` PK | aggregate counters |
| `child_genre_progress` | composite PK | first genre completion |
| `child_subject_stats` | composite PK | subject session counters |

## Verification Expectations

`d1/verify/schema_invariants.sql` should report:

| check_name | expected |
|---|---|
| `table_count` | `16` |
| `foreign_key_violations` | `0` |
| `expected_tables_missing` | `0` |
| `json_check_constraints_smoke` | `1` |

`index_count` is informational and may grow as #29/#30 tune query plans.
