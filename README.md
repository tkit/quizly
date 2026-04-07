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

### Dev セットアップ（ローカル）

ローカル開発手順は [`docs/setup_dev.md`](docs/setup_dev.md) を参照してください。  
上から順に実行すればセットアップできます。

日常の起動/停止は次の2コマンドで実行できます。

```bash
npm run dev:up
npm run dev:down
```

### Prod 運用（デプロイ/外部設定）

本番運用の手順・設定一覧は [`docs/operations_prod.md`](docs/operations_prod.md) を参照してください。

### 問題コンテンツ同期（Content Sync）

問題更新手順は [`docs/content_sync.md`](docs/content_sync.md) を参照してください。

## 🖼️ Badge Asset Workflow

現行バッジは SVG を配信しており、生成と運用は以下です。

- 生成スクリプト: `./scripts/generate_badges_arcade_style.sh`
- 配信先: `public/badges-arcade/svg`
- 制作ソース: `assets/badges/arcade_style/svg`

詳細手順は [`docs/badge_operations.md`](docs/badge_operations.md) を参照してください。
デザインガイドラインは [`docs/badge_design_guidelines.md`](docs/badge_design_guidelines.md) を参照してください。
