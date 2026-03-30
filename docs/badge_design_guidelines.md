# バッジデザインガイドライン

## 1. 目的

このガイドは、Quizly のバッジを新規追加・再生成するときに、デザイン品質と一貫性を保つための基準をまとめたものです。

## 2. 基本方針

- 達成感を最優先にする
- 64pxで一目で意味が伝わることを必須にする
- 子ども向けとして明るく、強いコントラストを使う
- 既存バッジと混ぜて表示しても違和感がないこと

## 3. ファイル運用

- SVG原本 / 配信用: `public/badges-arcade/svg`
- 命名:
  - 公開: `badge_<family>_l<level>.svg`
  - シークレット: `badge_secret_<key>.svg`

## 4. 外形ルール

- `perfect_sessions`: 六角勲章外形
- `subject_master`: 盾型外形
- `total_points`: 円形メダル外形（ポイント感を優先）
- その他（`streak_days`, `genre_explorer`, `secret`）: 花形 + 王冠外形
- 外形はフラット寄りで、過剰な立体表現は避ける

## 5. レベル表現

- レベルカラー:
  - `L1`: 青緑
  - `L2`: 青
  - `L3`: 銀
  - `L4`: 金
  - `L5`: 紫
- `L5` のみ特別演出:
  - オーラ線
  - 追加の星モチーフ
- レベルドット（下部5つ）で段階を明示する

## 6. モチーフ辞書（現行）

- `streak_days`: 稲妻
- `genre_explorer`: コンパス
- `perfect_sessions`: チェック
- `subject_master_japanese`: 「あ」を想起させる記号
- `subject_master_math`: `+-×÷`
- `subject_master_science`: 幾何学的フラスコ
- `subject_master_social`: 地球儀
- `total_points`: コイン積層 + 加点（プラス）記号
- `secret_comeback`: スパーク（✨）
- `secret_perfect_recovery`: 回復記号

## 7. 形状と可読性の基準

- 最小線幅: `2.0px` 以上
- 中央モチーフは1テーマに絞る
- 余白を確保し、外形と記号を密着させない
- 文字フォント直置きは禁止（記号はパスで定義）

## 8. 禁止事項

- グレー主体で達成感が弱い配色
- レベル差が色で判別できない設計
- 直接的すぎる記号（例: return文字そのまま）
- family間で外形ルールを崩すこと

## 9. 追加・修正時チェックリスト

1. familyごとの外形ルールを守っているか
2. `L1〜L5` が縮小表示でも判別できるか
3. `L5` の特別感が十分か
4. `history` 画面で連続表示しても違和感がないか
5. `icon_path` が `/badges-arcade/svg/*.svg` を向いているか

## 10. 変更手順（最小）

1. `scripts/generate_badges_arcade_style.sh` を修正
2. `bash scripts/generate_badges_arcade_style.sh` で再生成
3. `public/badges-arcade/svg` を確認
4. 必要なら migration で `badge_definitions.icon_path` を更新
