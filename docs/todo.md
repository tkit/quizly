# Quizly 改善 TODO リスト

> このドキュメントは、Quizly の今後の改善項目をまとめたものです。
> ステータス: ⬜ 未着手 / 🔧 進行中 / ✅ 完了

---

## 1. ⬜ GitHub Actions による CI の追加

**目的**: コード品質の維持と、デプロイ前の自動チェック

### やること
- [ ] ESLint / TypeScript の型チェックを CI で実行
- [ ] `npm run build` の成功を確認するジョブの追加
- [ ] PR 作成時に自動で CI が走る workflow の設定
- [ ] （将来）テストフレームワーク導入後、自動テストの実行を追加

### 備考
- `.github/workflows/ci.yml` に定義
- Node.js 20.x で実行

---

## 2. 🔧 ポイント機能の追加

**目的**: 学習のモチベーション向上。頑張りを数値で可視化する。

### 基本仕様
- [x] 1問正解するごとに **+N ポイント** を加算（例: +10pt）
- [x] 不正解でもポイントは **減らない**（0加算）
- [x] ユーザーごとの累計ポイントを保持・表示

### ボーナスポイント
- [ ] **連続正解ボーナス**: 1日に連続10問正解でボーナスポイント付与
- [ ] **デイリーチャレンジボーナス**: その日初めてクイズに挑戦した時のボーナス
- [x] **全問正解ボーナス**: 1セッションで全問正解した場合の追加ポイント（×1.5倍）

### UI / UX
- [x] ダッシュボードに累計ポイント表示
- [x] クイズ結果画面で獲得ポイントのアニメーション表示
- [x] ポイント獲得時のエフェクト（紙吹雪など）

### DB スキーマ変更
- [x] `users` テーブルに `total_points` カラム追加 + `point_transactions` テーブル作成
- [x] `study_sessions` に `earned_points` カラム追加

---

## 3. ✅ より深いカテゴリ（サブカテゴリ）の選択

**目的**: 「算数」のような粗いジャンルではなく、「小数の計算」「日本の都道府県」など具体的な単元で学習できるようにする。

### やること
- [x] `genres` テーブルに `parent_id` カラムを追加し、親子関係を表現
  - 例: `算数` > `小数の計算`, `分数`, `図形の面積`
  - 例: `社会` > `日本の都道府県`, `世界の国々`
  - 例: `理科` > `植物のつくり`, `天気と気温`
- [x] ダッシュボードの UI を親カテゴリ → サブカテゴリの2段階選択に変更
- [x] サブカテゴリごとにアイコンや色を設定可能にする
- [x] 問題を適切なサブカテゴリに紐づけるシードデータの設計

### 派生ToDo（今回スコープ外）
- [x] サブカテゴリごとの受講済み状態（未受講/受講済み）を表示

---

## 4. ⬜ 本格的なログイン / ログアウト機能

**目的**: 現状の簡易PINコード認証から、セキュアで本格的な認証へ移行する。

### やること
- [ ] Supabase Auth を活用した認証基盤の導入
- [ ] メールアドレス + パスワード、または OAuth（Google など）によるログイン
- [ ] ログアウト機能の実装
- [ ] セッション管理・認証状態の永続化
- [ ] Supabase RLS (Row Level Security) の強化（USING句による適切なアクセス制御）
- [ ] 子ども向けの簡易ログイン（PIN）と親向けの本格ログインの使い分け検討

---

## 5. ⬜ 画像・図を使った問題への対応

**目的**: 文字だけでなく、図形問題（算数）や地図問題（社会）など、ビジュアルを見て答える問題に対応する。

### 出題側（クイズ画面）
- [ ] 問題文に画像を表示できるようにする
- [ ] 選択肢に画像を使えるようにする（図形の選択など）

### 登録側（管理機能）
- [ ] 問題登録時に画像をアップロードできる仕組み
- [ ] Supabase Storage を活用した画像管理
- [ ] CSV / JSON インポート時の画像パス指定対応

### DB スキーマ変更
- [ ] `questions` テーブルの `image_url` カラムの活用（既に存在）
- [ ] 選択肢画像用のスキーマ拡張の検討

---

## 6. ⬜ 学習記録ページ

**目的**: 子ども自身が学習の積み重ねを振り返れるようにする。

### やること
- [ ] トップページに、子どもごとの学習記録への導線を表示する
- [ ] カレンダー形式での学習記録表示（GitHub の草のようなイメージ）
- [ ] 連続学習日数（ストリーク）の表示

### 備考
- 保護者向けの履歴一覧、ジャンル別正答率、「今週の学習」サマリーは `保護者管理モードの実装` に移管
- 問題単位の詳細分析は、まず保護者向けの履歴詳細で提供する

---

## 7. ⬜ 保護者管理モードの実装

**目的**: 保護者が子どものプロフィール管理、学習履歴の確認、学習傾向の把握、アカウント設定を行えるようにする。

### 子ども管理
- [x] 子どもの追加
- [x] 子どもの表示名変更
- [x] 子どもの削除
- [x] 子どもごとの累計ポイント、最終学習日、学習回数の表示

### 学習履歴
- [x] 子どもごとの受講履歴一覧を表示
- [x] 各受講について、日時・ジャンル・正答数・獲得ポイントを表示
- [x] セッション詳細で、どの問題を解き、どの選択肢を選び、正解/不正解だったかを確認できるようにする

### 学習分析
- [x] 直近7日/30日の学習回数を表示
- [x] ジャンル別の挑戦回数と正答率を表示
- [x] 最近よく間違えているジャンルを表示
- [x] 未学習ジャンルを表示
- [x] 最近の学習推移を簡易的に可視化する

### アカウント設定
- [x] 親PINの変更
- [x] 退会機能の実装
- [x] 退会時に子ども・学習履歴・ポイント履歴をまとめて削除する
- [ ] （将来）Supabase Auth の認証ユーザーも完全削除する非同期バッチ/管理フローを検討する

---

## 8. ⬜ 記述式の回答への対応

**目的**: 選択肢形式だけでなく、自分で答えを入力する問題形式に対応する。

### やること
- [ ] テキスト入力による回答 UI
- [ ] 表記ゆれへの対応（ひらがな/カタカナ、全角/半角など）
- [ ] 正解判定ロジックの設計（完全一致 or 許容範囲付き）

### 備考
- 表記ゆれの完全対応は難しく、手軽さも損なわれるため **優先度は低め**
- まずは数値回答（算数の計算問題など）から始めるのが現実的

---

## 9. ⬜ デザインテーマの選択機能

**目的**: 中学年以上の学習者を主対象にしつつ、個人の好みに合わせて見た目を切り替えられるようにする。

### やること
- [ ] 複数のデザインテーマを用意（例: ポップ、クール、パステル、ダークなど）
- [ ] フォントの切り替え（丸ゴシック系 / しっかり系など）
- [ ] テーマ選択 UI の実装（設定画面 or プロフィール画面）
- [ ] ユーザーごとのテーマ設定を DB に保存
- [ ] CSS 変数を活用したテーマ切り替え基盤

---

## 10. ⬜ 問題管理の改善

**目的**: 親（管理者）がより簡単に問題を追加・管理できるようにする。

### やること
- [ ] CSV / JSON ファイルからの一括問題インポート機能
- [ ] 問題追加用の管理画面 UI（簡易版）
- [ ] 問題の難易度設定（かんたん / ふつう / むずかしい）

---

## 11. ✅ ロゴ・favicon・OGP 画像の対応

**目的**: ブランディングの強化と、SNS シェア時の見栄えの向上。

### やること
- [x] Quizly のオリジナルロゴの作成
- [x] favicon の作成・設定（各サイズ対応）
- [x] OGP（Open Graph Protocol）画像の作成・メタタグ設定
- [x] Apple Touch Icon の設定（iPad ホーム画面追加時のアイコン）

---

## 12. ✅ PWA（Progressive Web App）対応

**目的**: iPad のホーム画面に追加してネイティブアプリのように使えるようにする。

### やること
- [x] `manifest.json` の作成
- [x] Service Worker によるオフライン対応の基盤
- [x] アプリアイコンの作成・設定
- [x] スプラッシュスクリーンの設定

---

## 13. ⬜ アクセシビリティ・UX の改善

**目的**: 子どもがより使いやすいインターフェースにする。

### やること
- [ ] 正解・不正解時のサウンドエフェクト
- [ ] 問題文の読み上げ機能（Web Speech API）
- [ ] フォントサイズの調整オプション
- [ ] タイマー機能（制限時間付きモード）

---

## 14. ⬜ 開発環境と本番環境の分離（Supabase / Auth）

**目的**: 認証プロバイダ設定・RLS・migration 適用を安全に運用し、開発操作が本番データに影響しない状態にする。

### やること
- [ ] Supabase プロジェクトを `dev` / `prod` で分離する（URL / anon key / project ref を分離）
- [ ] `.env.local`（開発）と本番環境変数（Vercel等）で、接続先 Supabase を明示的に切り替える
- [ ] Google OIDC / Magic Link / Passkey の設定を環境ごとに分離する（redirect URL を dev/prod で分ける）
- [ ] 開発環境のみ `Anonymous`（開発ショートカット）を有効化し、本番は無効化する
- [ ] migration 運用ルールを整理する（`dev` に先適用 -> 検証後 `prod` に適用）
- [ ] migration 適用手順書を更新する（どの project ref に対して `db:migration:up` を実行するか明記）
- [ ] dev/prod のシードデータ方針を分ける（開発用テストデータの本番混入防止）

### 備考
- 現在は暫定的に「開発/本番同一環境」で運用中。上記完了まで本番データ操作に注意。

### 追加Runbook（本番ドメイン移行: `study-quizly.vercel.app` -> `quizly.fruits-drill.com`）
1. **Cloudflare DNS 準備**
- [ ] `quizly.fruits-drill.com` を Vercel 向けに追加（`CNAME`）
- [ ] `auth.fruits-drill.com` を Supabase Custom Domain 向けに追加（Supabase 指定値）
- [ ] DNS 伝播を確認（`dig quizly.fruits-drill.com`, `dig auth.fruits-drill.com`）

2. **Vercel 側設定**
- [ ] Project Domains に `quizly.fruits-drill.com` を追加
- [ ] `https://quizly.fruits-drill.com` で証明書が有効なことを確認
- [ ] 既存 `https://study-quizly.vercel.app/` は移行完了まで残す

3. **Supabase Custom Domain 設定**
- [ ] Supabase Dashboard で `auth.fruits-drill.com` を設定・有効化
- [ ] 有効化後、Auth エンドポイントが `https://auth.fruits-drill.com/auth/v1/*` で応答することを確認
- [ ] 注意: 有効化後は `*.supabase.co` 前提の OAuth 設定が無効になるため、先に Google 側を更新しておく

4. **Google Cloud Console（OAuth）更新**
- [ ] OAuth 同意画面が `External + Testing` であることを確認
- [ ] テストユーザーに運用者メール（自分）を追加済みであることを確認
- [ ] Authorized JavaScript origins に以下を登録
  - [ ] `http://localhost:3000`
  - [ ] `https://quizly.fruits-drill.com`
  - [ ] `https://study-quizly.vercel.app`
- [ ] Authorized redirect URIs に以下を登録
  - [ ] `https://auth.fruits-drill.com/auth/v1/callback`
  - [ ] `https://<project-ref>.supabase.co/auth/v1/callback`（移行中のみ）

5. **Supabase Auth URL Configuration 更新**
- [ ] `Site URL` を `https://quizly.fruits-drill.com` に更新
- [ ] `Redirect URLs` に以下を登録
  - [ ] `http://localhost:3000/auth/callback`
  - [ ] `https://quizly.fruits-drill.com/auth/callback`
  - [ ] `https://study-quizly.vercel.app/auth/callback`（移行中のみ）

6. **アプリ環境変数更新（Vercel / local）**
- [ ] `NEXT_PUBLIC_SUPABASE_URL` を `https://auth.fruits-drill.com` に更新
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` が対象 Supabase project の値であることを確認
- [ ] `NEXT_PUBLIC_AUTH_MODE` と `NEXT_PUBLIC_ENABLE_DEV_AUTH_SHORTCUT` が本番値になっていることを確認

7. **疎通テスト（必須）**
- [ ] localhost で Google ログイン成功（`http://localhost:3000`）
- [ ] 本番ドメインで Google ログイン成功（`https://quizly.fruits-drill.com`）
- [ ] ログイン後、子プロフィール選択/自動遷移/ダッシュボードが正常動作
- [ ] 親ログアウト後に再ログイン可能

8. **切替完了と後片付け**
- [ ] 問題なければ Google OAuth から旧 `*.supabase.co` callback を削除
- [ ] Supabase `Redirect URLs` から旧 `study-quizly.vercel.app` を削除（完全移行後）
- [ ] README と運用手順書の本番URLを `quizly.fruits-drill.com` に更新
- [ ] 監視期間（1週間）を設け、認証エラー有無を確認

### 実行手順（Runbook）
1. **Supabase プロジェクト作成**
- [ ] `quizly-dev`（開発用）を新規作成
- [ ] 既存を `quizly-prod` として扱う（命名を揃える）
- [ ] 各プロジェクトの `project ref / URL / anon key` を安全な場所に記録

2. **ローカル CLI 接続先の切り替え方式を決める**
- [ ] `.env.supabase.local.dev` と `.env.supabase.local.prod` を作成
- [ ] `SUPABASE_PROJECT_ID` と `SUPABASE_ACCESS_TOKEN` を環境別に管理
- [ ] `npm run db:*` 実行前にどちらを読み込むかを明記（誤適用防止）

3. **DB migration の適用フロー固定**
- [ ] まず `dev` に `npm run db:migration:up` を適用
- [ ] `npm run build` と主要導線（ログイン/クイズ/結果）を dev で確認
- [ ] 問題なければ同じ migration を `prod` に適用
- [ ] 適用履歴（日時・担当者・対象 project）を残す

4. **Web アプリ環境変数の分離**
- [ ] `.env.local` は `dev` Supabase を参照
- [ ] 本番（Vercel など）は `prod` Supabase を参照
- [ ] `NEXT_PUBLIC_AUTH_MODE` / `NEXT_PUBLIC_ENABLE_DEV_AUTH_SHORTCUT` を dev/prod で分ける

5. **Auth Provider 設定（環境別）**
- [ ] Supabase `dev` の `Site URL` を `http://localhost:3000` に設定
- [ ] Supabase `dev` の `Redirect URL` に `http://localhost:3000/auth/callback` を設定
- [ ] Supabase `prod` の `Site URL` を `https://study-quizly.vercel.app/` に設定
- [ ] Supabase `prod` の `Redirect URL` に `https://study-quizly.vercel.app/auth/callback` を設定
- [ ] Google OIDC は dev/prod で OAuth クライアントを分ける（推奨）
- [ ] Magic Link の redirect も dev/prod を分離
- [ ] Passkey の RP/Origin を dev/prod で正しく設定

6. **Anonymous（開発ショートカット）の安全化**
- [ ] `dev`: Anonymous ON
- [ ] `prod`: Anonymous OFF
- [ ] アプリ側で `development` かつフラグON時のみショートカット表示を確認

7. **シードデータ戦略の分離**
- [ ] dev 用テストデータ（子1人/2人世帯）を用意
- [ ] prod には検証用ダミーデータを投入しない
- [ ] seed 実行対象の project を必ず明示

8. **運用ガードレール**
- [ ] `README` に「日次運用コマンド例（dev/prod）」を追記
- [ ] 「本番適用前チェックリスト」を作成（RLS / Auth / build / smoke test）
- [ ] 重大操作（本番 migration, Auth 設定変更）の実施ログを残す

---

## 15. ⬜ Upstash Redis の導入（キャッシュ / 短期状態 / 遅延評価）

**目的**: DB 負荷と待ち時間を下げつつ、短期状態（親PIN再認証など）を安全に扱えるようにする。

### 15-1. 親PIN再認証フローの短期状態を Redis 化（高優先）
- [x] `parent_reauth_challenges` の有効期限付き状態を Redis TTL キーで管理する設計を追加（またはDBと併用）
- [x] PIN 失敗回数のレート制限（例: guardian 単位 + IP 単位）を Redis で実装
- [x] 連続失敗時の一時ロック（cooldown）を Redis キーで実装

### 15-2. 保護者管理スナップショットの短TTLキャッシュ（高優先）
- [x] `getParentManagementSnapshot` の結果を `guardian_id` 単位でキャッシュ（15〜60秒）
- [x] 子ども追加/更新/削除、PIN更新、退会時に該当キャッシュを明示的に無効化
- [x] キャッシュヒット率・再計算時間を観測できるログを追加

### 15-3. ダッシュボード系マスタデータのキャッシュ（中優先）
- [x] `genres` と `get_active_question_counts` の結果を短TTLでキャッシュ
- [x] コンテンツ同期（`content:sync`）実行後に関連キャッシュをまとめて無効化できる運用を整備

### 15-4. クイズ問題セットの遅延評価 + キャッシュ（中優先）
- [x] `genre_id + child_id + count` をキーに、並び替え済み問題IDリストを短TTLでキャッシュ
- [x] 問題マスタ更新時（`questions` 更新）に該当ジャンルキーを無効化する仕組みを設計

### 15-5. 結果ページのセッション単位キャッシュ（中優先）
- [x] `session_id` 単位で `study_sessions + study_history` の結果をキャッシュ
- [x] セッション確定直後の取得に限定して短TTL運用（例: 1〜5分）を導入

### 15-6. セッション保存の冪等性強化（低〜中優先）
- [x] `complete_study_session` 呼び出し時の重複送信を防ぐ冪等キー（Redis）を導入
- [x] 二重送信時の扱い（同一結果返却 / エラー返却）を仕様化

### 実装メモ
- [x] Upstash REST API を利用する `src/lib/cache`（共通ラッパ）を作成
- [x] 環境変数（`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`）を `.env.local.example` に追記
- [x] キー命名規約（prefix, version, tenant/guardian/child 境界）を `docs/` に明記
- [x] フォールバック方針（Redis 障害時は DB 直読みに退避）を実装

---

## 優先度の目安

| 優先度 | 項目 |
|:---:|:---|
| 🔴 高 | 2. ポイント機能 / 3. サブカテゴリ / 5. 画像問題対応 / 15. Upstash Redis（短期状態・保護者スナップショット） |
| 🟡 中 | 1. CI / 4. 本格ログイン / 6. 学習記録ページ / 10. 問題管理 / 14. 環境分離 / 15. Upstash Redis（ダッシュボード・問題セット） |
| 🟢 低 | 7. 記述式回答 / 8. デザインテーマ / 11. PWA / 12. アクセシビリティ |
