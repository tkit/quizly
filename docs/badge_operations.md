# バッジ運用ガイド

## 1. 命名規約

### 画像ファイル名
- 公開バッジ: `badge_<family>_l<level>.png`
- シークレット: `badge_secret_<key>.png`

例:
- `badge_streak_days_l1.png`
- `badge_subject_master_math_l4.png`
- `badge_secret_comeback.png`

### DBキー
- 公開バッジ: `<family>_l<level>` または `subject_master_<subject>_l<level>`
- シークレット: `secret_<key>`

例:
- `streak_days_l3`
- `genre_explorer_l5`
- `subject_master_japanese_l2`
- `secret_perfect_recovery`

## 2. ディレクトリ運用

- 配信用（実行時に参照）:
  - `public/badges/64`
  - `public/badges/32`
- 保管用マスター:
  - `assets/badges/master`（`512x512`）
- 生成入力/中間:
  - `original`（Git管理外）
  - `.tmp/badges/transparent`（Git管理外）

## 3. 追加手順（運用フロー）

1. 画像を準備
- `original/*.png` に元画像を配置
- `./scripts/generate_badges.sh` を実行して `master / 64 / 32` を生成

2. DB定義を追加（migration）
- `badge_definitions` に新規キーを `INSERT`
- 必須項目:
  - `key`
  - `family`
  - `name`（ユーザー向け表示名）
  - `icon_path`（`/badges/64/...`）
  - `condition_json`
  - `sort_order`

3. 表示確認
- `/result` でバッジ名・条件文・画像が崩れないこと
- `/history` で「手に入れたバッジ一覧」「次のバッジまで」に反映されること
- 画像欠損時フォールバックが効くこと

4. 最終チェック
- `npm run build` が成功
- `npm run db:migration:up` でmigration適用

## 4. マニフェスト方式（定義）

将来のバッジ追加でコード変更を最小化するため、以下の方針で運用する。

- 正本は `badge_definitions`（DB）
- 補助資料として `assets/badges/manifest.json` を持つ
  - 目的: `key` と画像ファイルの対応確認、運用レビュー
  - 主に人間向け（現時点ではアプリ実行時には未使用）

想定フォーマット:

```json
{
  "version": 1,
  "items": [
    {
      "key": "streak_days_l1",
      "family": "streak_days",
      "icon_64": "/badges/64/badge_streak_days_l1.png",
      "icon_32": "/badges/32/badge_streak_days_l1.png"
    }
  ]
}
```

## 5. 非採用方針

- `/parent` に子ども別バッジ一覧は追加しない
  - 子どもごとの学習状況確認は `/history` を基本導線とする
  - 世帯内比較を主目的にしない
- バッジ専用 feature flag は現時点で導入しない
  - 本アプリ全体でfeature flag運用を行っていないため

## 6. 障害時の最小対応（運用）

重大不具合でバッジ表示のみ一時停止したい場合は、以下の最小差分で対応する。

1. 表示停止対象を決める
- `/result` の新規バッジ通知
- `/history` のバッジまとめ
- `/dashboard` のバッジサマリ

2. UIだけを一時的に無効化
- データ保存（DB/RPC）は止めず、画面表示のみを外す
- 影響範囲が小さいため、短時間で復旧しやすい

3. 復旧時
- UI表示コードを戻す
- `npm run build` で確認後に再デプロイ
