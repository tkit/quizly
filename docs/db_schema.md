# データベース設計 (Supabase/PostgreSQL)

本ドキュメントでは、学習アプリケーションのデータ構造（テーブル定義）を定義します。
バックエンドとして Supabase (PostgreSQL) を利用し、主に学習記録の保存と簡易認証情報の管理を行います。

## テーブル一覧

1. `users` (ユーザー)
2. `genres` (問題ジャンル)
3. `questions` (問題データ)
4. `study_sessions` (学習セッション)
5. `study_history` (解答履歴詳細)

---

## 1. `users` テーブル
システムを利用する子供たちのアカウント情報を管理します。
簡易認証のため、パスワードではなく簡単な数字（PINコード）を保存します。

| カラム名 | データ型 | 制約 | 説明 |
| :--- | :--- | :--- | :--- |
| `id` | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() | ユーザーの一意なID |
| `name` | text | NOT NULL | 子供の表示名（例: 「たろう」「はなこ」） |
| `icon_url` | text | | アイコン画像のURL、または絵文字等 |
| `pin_code_hash` | text | NOT NULL | 4桁の数字PINをハッシュ化した値（生の値は保存しない） |
| `created_at` | timestamp with time zone | DEFAULT now() | 作成日時 |

## 2. `genres` テーブル
問題のジャンル（算数、歴史など）を管理します。

| カラム名 | データ型 | 制約 | 説明 |
| :--- | :--- | :--- | :--- |
| `id` | text | PRIMARY KEY | ジャンルの一意な識別子（例: 'math', 'history'） |
| `name` | text | NOT NULL | ジャンルの表示名（例: 「さんすう」「れきし」） |
| `icon` | text | | ジャンルに対応するアイコン（絵文字またはURL） |
| `description` | text | | ジャンルの説明 |
| `color_hint` | text | | UI表示色を分けるためのヒント（例: 'blue', 'orange'） |

## 3. `questions` テーブル
実際の問題データを管理します。
当面は管理画面を作成せず、親（エンジニア）が JSON ファイル等から DB にシード（一括登録）する運用を想定しています。

| カラム名 | データ型 | 制約 | 説明 |
| :--- | :--- | :--- | :--- |
| `id` | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() | 問題の一意なID |
| `genre_id` | text | FOREIGN KEY (genres.id) | この問題が属するジャンルのID |
| `question_text` | text | NOT NULL | 問題の本文 |
| `options` | jsonb | NOT NULL | 選択肢の配列（例: `["徳川家康", "織田信長", "豊臣秀吉"]`） |
| `correct_index` | integer | NOT NULL | 正解となる選択肢のインデックス（0始まり） |
| `explanation` | text | | 正解/不正解時に表示する解説文 |
| `image_url` | text | | 将来用: 問題に付随する画像のURL |
| `is_active` | boolean | DEFAULT true | 問題が有効かどうか（無効化して非表示にできる） |
| `created_at` | timestamp with time zone | DEFAULT now() | 作成日時 |

## 4. `study_sessions` テーブル
「〇〇さんが、いつ、〇〇ジャンルを何問解いて、どうだったか」という1回のテスト（セッション）全体の結果を記録します。

| カラム名 | データ型 | 制約 | 説明 |
| :--- | :--- | :--- | :--- |
| `id` | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() | セッションの一意なID |
| `user_id` | uuid | FOREIGN KEY (users.id) | 挑戦したユーザーのID |
| `genre_id` | text | FOREIGN KEY (genres.id) | 挑戦したジャンルのID |
| `mode` | text | DEFAULT 'normal' | 'normal'（通常） または 'review'（復習） |
| `total_questions` | integer | NOT NULL | 出題された全問題数 |
| `correct_count`| integer | NOT NULL | 正解数 |
| `started_at` | timestamp with time zone | DEFAULT now() | 開始日時 |
| `completed_at` | timestamp with time zone | | 終了日時 |

## 5. `study_history` テーブル
セッション内で、具体的にどの問題をどう答えたか（1問単位の正誤）の履歴を記録します。
このテーブルを使って「過去に間違えた問題だけを抽出（復習モード）」を実現します。

| カラム名 | データ型 | 制約 | 説明 |
| :--- | :--- | :--- | :--- |
| `id` | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() | レコードの一意なID |
| `session_id` | uuid | FOREIGN KEY (study_sessions.id) | 属するセッションのID |
| `user_id` | uuid | FOREIGN KEY (users.id) | 答えたユーザーのID |
| `question_id`| uuid | FOREIGN KEY (questions.id) | 解いた問題のID |
| `is_correct` | boolean | NOT NULL | 正解したか（true: 正解, false: 不正解） |
| `selected_index`| integer | NOT NULL | ユーザーが選んだ選択肢のインデックス |
| `answered_at`| timestamp with time zone | DEFAULT now() | 解答した日時 |

---

## 復習（再チャレンジ）機能の取得ロジック案
復習モードで問題を取得する際の大まかな SQL（参考）:
```sql
SELECT q.*
FROM questions q
JOIN study_history sh ON q.id = sh.question_id
WHERE sh.user_id = '指定ユーザーのID'
  AND sh.is_correct = false
  AND q.genre_id = '指定ジャンル'
  -- ※同じ問題を複数回解いて最後は正解している場合を除外するなどのフィルタリングが必要
```
