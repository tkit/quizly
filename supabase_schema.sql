-- 1. users テーブル
CREATE TABLE public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  icon_url text,
  pin_code_hash text NOT NULL,
  total_points integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

-- RLS (Row Level Security) の設定 (テスト運用のためまずは全通しにします)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to users" ON public.users FOR ALL USING (true);


-- 2. genres テーブル
CREATE TABLE public.genres (
  id text PRIMARY KEY,
  name text NOT NULL,
  parent_id text REFERENCES public.genres(id),
  icon_key text NOT NULL,
  description text,
  color_hint text
);

ALTER TABLE public.genres ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to genres" ON public.genres FOR ALL USING (true);


-- 3. questions テーブル
CREATE TABLE public.questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  genre_id text REFERENCES public.genres(id),
  question_text text NOT NULL,
  options jsonb NOT NULL,
  correct_index integer NOT NULL,
  explanation text,
  image_url text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to questions" ON public.questions FOR ALL USING (true);


-- 4. study_sessions テーブル
CREATE TABLE public.study_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id),
  genre_id text REFERENCES public.genres(id),
  mode text DEFAULT 'normal',
  total_questions integer NOT NULL,
  correct_count integer NOT NULL,
  earned_points integer DEFAULT 0,
  started_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone
);

ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to study_sessions" ON public.study_sessions FOR ALL USING (true);


-- 5. study_history テーブル
CREATE TABLE public.study_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES public.study_sessions(id),
  user_id uuid REFERENCES public.users(id),
  question_id uuid REFERENCES public.questions(id),
  is_correct boolean NOT NULL,
  selected_index integer NOT NULL,
  answered_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.study_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to study_history" ON public.study_history FOR ALL USING (true);


-- 6. point_transactions テーブル (ポイント履歴)
CREATE TABLE public.point_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id),
  session_id uuid REFERENCES public.study_sessions(id),
  points integer NOT NULL,
  reason text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to point_transactions"
  ON public.point_transactions FOR ALL USING (true);


-- ==== 動作確認用初期データ（シードデータ） ====
-- ジャンル（2階層: 教科 -> サブカテゴリ）
INSERT INTO public.genres (id, name, parent_id, icon_key, description, color_hint) VALUES
('math', '算数', NULL, 'calculator', '計算や図形の基礎を学ぶ', 'blue'),
('japanese', '国語', NULL, 'book_open', 'ことばや文の読み書き', 'pink'),
('social', '社会', NULL, 'map', '地理や歴史の基礎を学ぶ', 'orange'),
('science', '理科', NULL, 'microscope', '自然や科学のしくみを学ぶ', 'green'),
('math-basic-calc', '計算マスター', 'math', 'calculator', '四則計算の基礎を身につける', 'blue'),
('math-time', '時間と時計', 'math', 'clock', '時刻の読み取りと時間計算を学ぶ', 'blue'),
('jp-grammar-01', '文法マスター 第1回: 和語(1)', 'japanese', 'notebook', '和語の意味と使い方', 'pink'),
('jp-grammar-02', '文法マスター 第2回: 慣用句(1)', 'japanese', 'message', '慣用句の読み取り', 'pink');

-- 問題（サブカテゴリのサンプル）
INSERT INTO public.questions (genre_id, question_text, options, correct_index, explanation) VALUES
('math-basic-calc', '15 + 27 はいくつですか？', '["32", "42", "52"]', 1, '1の位は 5+7=12 です。2を残して1を十の位に繰り上げると、十の位は 1+2+1=4 なので、答えは42です。'),
('math-time', '1日は何時間ですか？', '["12時間", "20時間", "24時間"]', 2, '1日は24時間です。'),
('jp-grammar-01', '「山道」を読むとき、正しいのはどれ？', '["やまみち", "さんどう", "やまどう"]', 0, '和語として読む場合は「やまみち」が正解です。'),
('jp-grammar-02', '「あしをひっぱる」の意味として正しいのはどれ？', '["協力して助ける", "じゃまをする", "走るのが速い"]', 1, '慣用句「あしをひっぱる」は、じゃまをするという意味です。');
