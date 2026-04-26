# RPC Replacement

最終更新: 2026-04-27  
対象Issue: #29 / 親Issue: #24

## 目的

Supabase SQL RPC へ依存していた runtime behavior を app-layer service へ移す。#29 の主対象は以下の3つ。

| Supabase RPC | Replacement |
|---|---|
| `get_active_question_counts` | `questions` を通常 query し、active question count を app-layer で集計 |
| `get_child_study_status` | `study_sessions` を通常 query し、genre status を app-layer で集計 |
| `complete_study_session` | `src/lib/study/completeSession.ts` の app-layer service |

## 現在の境界

#29 では runtime の `.rpc(...)` 呼び出しを削除し、PL/pgSQL 固有の business logic を TypeScript service へ移す。D1 schema は #28 で追加済み。Cloudflare D1 binding と repository 切替は、remote D1 作成・data import・app-layer guard と合わせて #30 以降で固める。

この段階の `completeStudySessionInAppLayer` は、既存 route から呼び出せる service として Supabase table access を使う。D1 へ接続した後は、この service の責務を D1 transaction repository に差し替える。

## Parity Notes

`completeStudySessionInAppLayer` が担う責務:

- `study_sessions` 作成
- `study_history` 作成
- `point_transactions` 作成
- `child_profiles.total_points` 更新
- `child_streak_state` 更新
- `child_learning_stats` / `child_genre_progress` / `child_subject_stats` 更新
- badge unlock と `badge_unlock_events` 作成
- secret badge 判定

`study-sessions/complete` route 側に残る責務:

- request validation
- active child cookie check
- idempotency key handling
- daily point state calculation and rollback fallback
- cache invalidation

## Remaining Work

- D1 remote database/binding creation
- D1 transaction wrapper for `completeStudySessionInAppLayer`
- Supabase table access replacement outside RPC paths
- App-layer authorization guards for every protected D1 query (#30)
- Upstash idempotency lock replacement (#31)
