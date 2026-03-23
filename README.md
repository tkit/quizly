# 📝 Quizly (クイズリー)

小学3年生の子供が楽しく継続して学習できる、問題演習形式のWebサイト「Quizly（クイズリー）」のリポジトリです。
親しみやすいUIで、算数や歴史などの問題に挑戦でき、解いた履歴やニガテな問題の復習が可能です。

## 🚀 Tech Stack

- **Frontend**: Next.js (App Router), TypeScript, Tailwind CSS
- **UI Components**: shadcn/ui, Lucide React
- **Backend / DB**: Supabase (PostgreSQL)
- **Deployment**: Vercel

## 📁 Project Structure

- `src/app/`: Next.js アプリケーションの各画面 (App Router)
  - `/`: ログイン画面 (PINコード認証)
  - `/dashboard`: トップページ (ジャンル選択)
  - `/setup`: 問題の出題設定 (問題数、モード選択)
  - `/quiz`: クイズ解答画面
  - `/result`: 学習結果・振り返り画面
- `docs/`: 仕様書および設計ドキュメント (`requirements.md`, `db_schema.md`, `ui_design.md`)
- 認証・認可の仕様書（正本）: `docs/auth_spec.md`
- `supabase/migrations/`: 公式 migration（正本）
- `supabase/migrations/20260320000000_baseline_schema.sql`: baseline（初期状態）

## 🛠️ Getting Started

### 1. Prerequisites

- Node.js 18+ (開発環境ではNode.js 20以上を推奨)
- Supabase Project
- Supabase CLI (`npx supabase` で利用可)

### 2. Environment Setup

Supabaseプロジェクトを作成し、URLとAnon Keyを取得して `.env.local` を作成します。

**Web App (`.env.local`)**

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
NEXT_PUBLIC_AUTH_MODE=production
NEXT_PUBLIC_ENABLE_DEV_AUTH_SHORTCUT=false
```

ローカル検証で認証ショートカットを使う場合:

```bash
NEXT_PUBLIC_AUTH_MODE=development
NEXT_PUBLIC_ENABLE_DEV_AUTH_SHORTCUT=true
```

OAuth / Magic Link の redirect には `http://localhost:3000/auth/callback` を追加してください。

**Supabase CLI用 (`.env.supabase.local`)**

```bash
SUPABASE_PROJECT_ID=<project-ref>
SUPABASE_ACCESS_TOKEN=<personal-access-token>
```

### 3. Database Setup (Schema Migration運用)

このリポジトリでは、**スキーマ変更のみ** `supabase/migrations` で管理します。  
SQL Editor での直接変更は避けてください。

#### 3-1. プロジェクトをリンク

初回のみ、ローカル設定ファイルを作成します。

```bash
npx supabase init
```

CLI用環境変数を読み込み、その後プロジェクトをリンクします。

```bash
set -a
source .env.supabase.local
set +a

npx supabase link --project-ref "$SUPABASE_PROJECT_ID"
```

#### 3-2. 既存環境の baseline 化（初回のみ）

既に稼働中のDBに対しては、baseline migration を「適用済み」として登録します。  
これにより既存スキーマへ再適用せず、以後は未適用分だけ追従できます。

```bash
npx supabase migration repair --status applied 20260320000000
```

#### 3-3. 新規環境 / 未適用分の反映

```bash
npm run db:migration:up
```

#### 3-4. 現在の適用状況を確認

```bash
npm run db:status
```

`db:*` スクリプトは `.env.supabase.local` を自動読込します。

#### 3-5. 新しい schema migration を追加

```bash
npm run db:migration:new -- add_some_change
```

生成された SQL ファイルを編集し、`npm run db:migration:up` で適用します。

#### 3-6. linked schema diff を確認

```bash
npm run db:diff:linked
```

### 4. Content Sync (問題コンテンツ運用)

問題データ（`genres/questions` の内容）は schema migration と分離し、Supabase Storage を正本として同期します。
この運用では **Supabase Storage上の現行JSON = 実際に配信される問題** とします。

必要な環境変数（公開しないこと）:

```bash
SUPABASE_SECRET_KEY=<service-role-key>
CONTENT_BUCKET=quiz-content
CONTENT_OBJECT_KEY=japanese/grammar/content.json
UPSTASH_REDIS_REST_URL=https://<id>.upstash.io
UPSTASH_REDIS_REST_TOKEN=<upstash-rest-token>
```

`SUPABASE_SECRET_KEY` はアプリ用の `.env.local` には置かず、`.env.content.local` に設定してください（例: `.env.content.local.example` をコピー）。
`UPSTASH_REDIS_REST_*` を設定すると、`content:sync` 完了時にダッシュボードキャッシュ（genres/問題数）を自動で無効化します。

コマンド:

```bash
# Storage上のJSON構造を検証
npm run content:validate

# 差分だけ確認（反映しない）
npm run content:sync:dry

# DBへ反映（upsert + deactivate）
npm run content:sync
```

同期ポリシー:
- `jp-grammar-01..20` ジャンルを upsert
- 問題は `genre_id + question_text` をキーに insert / update
- JSONから消えた問題は削除せず `is_active=false`（履歴保全）

更新フロー（シンプル運用）:
1. Storage の `CONTENT_OBJECT_KEY` で指定したファイル（例: `japanese/grammar/content.json`）を上書き
2. `npm run content:validate`
3. `npm run content:sync:dry`
4. `npm run content:sync`

### 5. Database Rules

- スキーマ変更は必ず migration ファイル経由で行う
- 既存 migration は append-only（追記のみ、原則書き換え禁止）
- 問題コンテンツ更新に migration は使わず `content:sync` を使う
- `contents/` と問題投入用SQLはGit管理対象にしない
- `20260322224000` / `20260322233000` は過去資産として凍結し、今後の更新手段にしない

### 6. Run Development Server

```bash
npm install
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開いてアプリケーションにアクセスします。
