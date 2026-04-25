# Redis Key Naming Convention (Quizly)

最終更新: 2026-03-24

## 目的
- キー衝突の防止
- キャッシュ無効化の粒度を明確化
- 世帯境界（guardian/child）をキー設計で明示化

## 命名ルール
- 基本形式: `quizly:<domain>:<resource>:v<schema_version>:<scoping...>`
- `quizly`:
  - プロダクトprefix（他システムとの衝突防止）
- `<domain>`:
  - `parent_reauth`, `dashboard`, `quiz_question_set`, `result_session` など責務単位
- `<resource>`:
  - `session`, `catalog`, `idempotency` など
- `v<schema_version>`:
  - キー構造や値構造が変わる時にインクリメント
- `<scoping...>`:
  - 参照境界に応じて `guardian_id` / `child_id` / `session_id` / `genre_id` を含める

## 境界ルール（tenant / guardian / child）
- tenant境界（世帯境界）
  - 保護者データは必ず `guardian_id` を含める
- child境界
  - 子ども依存の値は `child_id` を含める
- 共通マスタ
  - 全ユーザー共通の値はIDを含めず単一キーで運用

## 現在のキー一覧
- 親再認証
  - `quizly:parent_reauth:session:<guardian_id>`
  - `quizly:parent_reauth:attempts:guardian:<guardian_id>`
  - `quizly:parent_reauth:attempts:ip:<ip_hash>`
  - `quizly:parent_reauth:cooldown:<guardian_id>`
- 保護者管理スナップショット
  - `quizly:parent_snapshot:v1:<guardian_id>`
- ダッシュボードカタログ
  - `quizly:dashboard:catalog:v2`
- クイズ問題セット
  - `quizly:quiz_order_version:v1:<genre_id>`
  - `quizly:quiz_question_set:v1:<genre_id>:<child_id>:<count>:v<genre_version>`
- 結果ページ
  - `quizly:result_session:v1:<guardian_id>:<session_id>`
- セッション保存の冪等性
  - `quizly:study_session_complete:idempotency:v1:<guardian_id>:<child_id>:<idempotency_key>`
- バッジ概要
  - `quizly:badge_overview:overview:v1:<child_id>`
  - `quizly:badge_overview:summary:v1:<child_id>`

## バージョン更新方針
- 値構造変更時は `vN` を繰り上げる
- 互換性がない変更時は旧キーを削除せず自然失効させる（TTL運用）

## TTL方針（現行）
- 親再認証セッション: 15分
- 親PINクールダウン: 5分
- 保護者スナップショット: 5分
- ダッシュボードカタログ: 10分
- クイズ問題セット: 10分
- 結果ページセッション: 5分
- セッション保存冪等キー: 60分
- バッジ概要（overview/summary）: 60秒
