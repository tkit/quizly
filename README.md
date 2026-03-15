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
- `supabase_schema.sql`: Supabase データベースの初期構文およびシードデータ

## 🛠️ Getting Started

### 1. Prerequisites

- Node.js 18+ (開発環境ではNode.js 20以上を推奨)
- Supabase Project

### 2. Environment Setup

Supabaseプロジェクトを作成し、URLとAnon Keyを取得して `.env.local` を作成します。

**Web App (`.env.local`)**

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

### 3. Database Setup

Supabaseの SQL Editor で `supabase_schema.sql` の内容を実行し、テーブルの作成と初期データ（ジャンル、問題サンプル）を投入します。

動作確認のため、テストユーザーを追加する場合は以下のSQLを追加で実行します。

```sql
INSERT INTO public.users (id, name, icon_url, pin_code_hash) 
VALUES (gen_random_uuid(), 'たろう', '🧑‍🎓', '1234');
```

### 4. Run Development Server

```bash
npm install
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開いてアプリケーションにアクセスします。
