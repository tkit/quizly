# 認証・認可仕様（Guardian-Child Model）

最終更新: 2026-04-04  
本仕様は Quizly の認証・認可に関する正本です。実装・設計判断は本書を優先します。

## 1. 目的
- 子どもの学習開始体験を最短化する（PIN不要）。
- 保護者向けの管理機能だけを確実に保護する（親PINによるロック解除）。
- 世帯単位のデータ分離をRLSで保証する。

## 2. アカウントモデル
- 親アカウント:
  - Supabase Auth のユーザーを保護者として扱う。
  - `guardian_accounts` でプロフィール拡張を持つ。
- 子プロフィール:
  - `child_profiles` に複数登録可能。
  - 学習開始時は子を選ぶだけでよい（子PINなし）。
- 関係:
  - v1 は「1保護者アカウント : 複数子プロフィール」。

## 3. 認証方式（親）
- 親ログイン手段:
  - Google OIDC
  - Magic Link
  - Passkey（利用可能環境のみ）
- 開発時のみ任意で匿名ショートカット可（環境変数で有効化時のみ）。

## 4. セッション仕様
- 親セッション:
  - Supabase Auth セッションを利用。
- 子セッション:
  - `quizly_active_child`（httpOnly Cookie）で保持。
- ログアウト:
  - 子切替: 子cookieのみ削除（保護者セッションは維持）。
  - 親ログアウト: 子cookie削除 + Supabase signOut。

## 5. PIN仕様（親のみ）
- 子PIN:
  - 使用しない（常に不要）。
- 親PIN:
  - 管理機能（設定・履歴・問題管理）に入る際に要求。
  - 4桁数字固定。
  - ハッシュ化して `guardian_accounts.parent_pin_hash` に保存。
- 親ロック解除:
  - `/api/auth/parent/reauth/start` でPIN検証成功時、再認証セッションを期限付きで発行する。
  - Redis（Upstash）利用時は Redis TTL キーに保存し、障害時は `parent_reauth_challenges` へフォールバックする。
  - TTL は 15分。
  - 期限内は管理モード継続可。
- PIN失敗時のロックアウト:
  - カウント単位: `guardian_id` と `IP`（`x-forwarded-for` の先頭IPを利用）。
  - 判定窓: 10分。
  - 失敗閾値: 5回。
  - 閾値到達時: 5分のクールダウンを発行し、`POST /api/auth/parent/reauth/start` は `429` を返す。
- ロックアウト解除:
  - 時間経過による自動解除: クールダウン TTL（5分）満了で解除。
  - 成功入力による解除: 正しいPIN入力時に失敗カウンタとクールダウンを即時クリア。
  - 手動解除APIは v1 では提供しない。

## 6. 画面フロー
- `/`:
  - 親ログイン。
  - 子プロフィールがなければ作成。
  - 子プロフィールが1件以上なら選択して学習開始。
- `/dashboard`:
  - 学習導線。
  - `保護者管理` ボタンから `/parent` へ遷移。
- `/parent`:
  - 親PIN未設定なら初期設定。
  - 設定済みならPIN入力でロック解除。
  - 解除後に管理系機能へ遷移可能。

## 7. API仕様（認証関連）
- `POST /api/session/child/select`
  - 親のBearerトークン必須。
  - 引数: `childId`
  - 成功時に `quizly_active_child` cookie を設定。
- `GET /api/session/child/current`
  - 親のBearerトークン必須。
  - 現在の子プロフィールを返す。
- `POST /api/session/child/logout`
  - `quizly_active_child` cookie を削除。
- `POST /api/children/create`
  - 親のBearerトークン必須。
  - 子プロフィールを作成（PIN不要）。
- `GET /api/auth/parent/pin/status`
  - 親PIN設定有無を返す。
- `POST /api/auth/parent/pin/set`
  - 4桁親PINを設定（上書き可）。
- `POST /api/auth/parent/reauth/start`
  - 親PINを検証し、再認証記録を発行。
  - ステータス:
    - `200`: 検証成功（`expiresAt` を返却）
    - `403`: PIN不一致
    - `429`: クールダウン中、または失敗回数閾値到達でロックアウト
- `GET /api/auth/parent/reauth/verify`
  - 有効な再認証記録の有無を返す。

## 8. データモデル（認証関連）
- `guardian_accounts`
  - `id` (auth.users.id)
  - `email`
  - `display_name`
  - `parent_pin_hash` (nullable)
- `child_profiles`
  - `id`
  - `guardian_id`
  - `display_name`
  - `avatar_url`
  - `total_points`
- `parent_reauth_challenges`
  - `id`
  - `guardian_id`
  - `expires_at`

## 9. 認可（RLS）方針
- 原則:
  - `auth.uid()` と同一 `guardian_id` 配下データのみアクセス可。
- 学習データ:
  - `study_sessions`, `study_history`, `point_transactions` は `child_id -> guardian_id` で世帯境界を強制。
- 公開データ:
  - `genres`, `questions` は読み取り許可。

## 10. 環境運用ルール（単一プロジェクト運用時）
- 本章は認証観点の要件のみを扱う。デプロイ手順と外部サービス設定一覧は `docs/operations_prod.md` を参照する。
- `Site URL` は本番URLを設定する。
- `Redirect URLs` に本番とlocalhostの両方を登録する。
- 本番環境:
  - `NEXT_PUBLIC_AUTH_MODE=production`
  - `NEXT_PUBLIC_ENABLE_DEV_AUTH_SHORTCUT=false`
- 開発ショートカットは開発時だけ有効化する。
- Redis利用時は以下をサーバー環境変数に設定する（`NEXT_PUBLIC_` は付けない）:
  - `UPSTASH_REDIS_REST_URL`
  - `UPSTASH_REDIS_REST_TOKEN`

## 11. 将来拡張
- 複数保護者（招待制）対応。
- 管理機能単位の細粒度権限。
- 親PINの変更履歴。
