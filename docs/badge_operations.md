# バッジ運用ガイド（SVG版）

デザイン方針は `docs/badge_design_guidelines.md` を正本とし、本ドキュメントは生成・DB反映・運用手順に特化します。

## 1. 命名規約

### 画像ファイル名
- 公開バッジ: `badge_<family>_l<level>.svg`
- シークレット: `badge_secret_<key>.svg`

例:
- `badge_streak_days_l1.svg`
- `badge_subject_master_math_l4.svg`
- `badge_secret_comeback.svg`

### DBキー
- 公開バッジ: `<family>_l<level>` または `subject_master_<subject>_l<level>`
- シークレット: `secret_<key>`

例:
- `streak_days_l3`
- `genre_explorer_l5`
- `subject_master_japanese_l2`
- `secret_perfect_recovery`

## 2. ディレクトリ運用

- SVG原本 / 配信用（実行時参照）:
  - `public/badges-arcade/svg`
- 生成入力:
  - `original`（Git管理外、キー一覧用途）

## 3. 追加手順（運用フロー）

1. SVGを生成
- `./scripts/generate_badges_arcade_style.sh`

2. DB定義を追加または更新（migration）
- `badge_definitions` の `icon_path` は `'/badges-arcade/svg/<filename>.svg'`
- 必須項目:
  - `key`
  - `family`
  - `name`
  - `icon_path`
  - `condition_json`
  - `sort_order`

3. 表示確認
- `/result` と `/history` でレイアウト崩れがないこと
- 64px相当で視認性が保たれていること
- 画像欠損時フォールバックが効くこと

4. 最終チェック
- `npm run build`
- `npm run db:migration:up`

## 4. デザインルール（現行）

- `perfect_sessions` は六角勲章外形
- `subject_master` は盾型外形
- その他は花形 + 王冠外形
- レベル色:
  - `L1`: 青緑
  - `L2`: 青
  - `L3`: 銀
  - `L4`: 金
  - `L5`: 紫（オーラ/星の特別演出）

## 5. 非採用方針

- `/parent` に子ども別バッジ一覧は追加しない
- バッジ専用 feature flag は導入しない

## 6. 障害時の最小対応（運用）

1. 表示停止対象を決める
- `/result` の新規バッジ通知
- `/history` のバッジまとめ
- `/dashboard` のバッジサマリ

2. UIのみ一時停止
- データ保存（DB/RPC）は継続

3. 復旧時
- UI表示コードを戻す
- `npm run build` 確認後に再デプロイ
