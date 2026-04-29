# 📝 Quizly (クイズリー)

小学3年生の子供が楽しく継続して学習できる、問題演習形式のWebサイト「Quizly（クイズリー）」のリポジトリです。
親しみやすいUIで、算数や歴史などの問題に挑戦でき、解いた履歴やニガテな問題の復習が可能です。

## 🚀 Tech Stack

- **Frontend**: Next.js (App Router), TypeScript, Tailwind CSS
- **UI Components**: shadcn/ui, Lucide React
- **Backend / DB**: Cloudflare Workers + D1
- **Auth**: Clerk
- **Deployment**: Cloudflare Workers

## 📁 Project Structure

- `src/app/`: Next.js アプリケーションの各画面 (App Router)
  - `/`: 保護者ログイン・子ども選択
  - `/dashboard`: トップページ (ジャンル選択)
  - `/setup`: 問題の出題設定 (問題数、モード選択)
  - `/quiz`: クイズ解答画面
  - `/result`: 学習結果・振り返り画面
- `d1/migrations/`: D1 schema migration
- `docs/`: 仕様書および設計ドキュメント

## 🛠️ Getting Started

### Dev セットアップ（ローカル）

```bash
npm install
npm run dev
```

Cloudflare staging build/deploy は次のコマンドで実行します。

```bash
npm run cf:build:staging
npm run cf:deploy-built:staging
```

## 🖼️ Badge Asset Workflow

現行バッジは SVG を配信しており、生成と運用は以下です。

- 生成スクリプト: `./scripts/generate_badges_arcade_style.sh`
- 配信先: `public/badges-arcade/svg`
- 制作ソース: `assets/badges/arcade_style/svg`

詳細手順は [`docs/badge_operations.md`](docs/badge_operations.md) を参照してください。
デザインガイドラインは [`docs/badge_design_guidelines.md`](docs/badge_design_guidelines.md) を参照してください。
