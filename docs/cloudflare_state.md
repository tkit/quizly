# Cloudflare State Conventions

最終更新: 2026-04-30

## 目的

Cloudflare 移行後は Upstash Redis を runtime dependency として使わない。短い TTL を持つ状態は、D1 の state table で期限を表現し、必要に応じて読み書き時に期限切れ行を掃除する。

## 現在の状態管理

| 用途 | 保存先 | TTL | 備考 |
| :--- | :--- | :--- | :--- |
| 親再認証セッション | `parent_reauth_challenges` | 15分 | `guardian_id` 単位。成功時に既存 session を削除してから作成する。 |
| 親 PIN 失敗回数 | `parent_pin_attempt_state` | 10分 | `guardian:<guardian_id>` と `ip:<ip_hash>` の scope で回数を持つ。 |
| 親 PIN cooldown | `parent_pin_cooldowns` | 5分 | 失敗回数が閾値を超えた guardian を一時的に 429 にする。 |
| 学習完了 idempotency | `study_completion_idempotency` | 60分 | 同一 guardian/child/idempotency key の重複完了を防ぐ。 |
| Auth.js session | `sessions` | 30日 | `__Host-quizly_session` を Auth.js D1 adapter の database session として保存。7日ごとに更新する。 |

## 運用メモ

- Upstash Redis の環境変数は不要。
- Clerk の環境変数は不要。Auth.js Google OAuth には `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `AUTH_SECRET` を使う。
- `npm run cf:preview` の前に、ローカル D1 へ `npm run d1:migrate:local:staging` で migration を適用する。
- staging では `npx wrangler d1 migrations apply quizly-staging --env staging` で D1 migration を適用してから Worker を deploy する。
- `study_completion_idempotency` は `in_progress` lock を 60秒で再取得可能にし、完了後は保存済み response を返す。
- TTL は D1 の `expires_at` で表現するため、期限切れ行は読み書き時または将来の scheduled cleanup で削除する。
