-- 1. users テーブル
CREATE TABLE public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  icon_url text,
  pin_code_hash text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- RLS (Row Level Security) の設定 (テスト運用のためまずは全通しにします)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to users" ON public.users FOR ALL USING (true);


-- 2. genres テーブル
CREATE TABLE public.genres (
  id text PRIMARY KEY,
  name text NOT NULL,
  icon text,
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

-- ==== 動作確認用初期データ（シードデータ） ====
-- ジャンル
INSERT INTO public.genres (id, name, icon, description, color_hint) VALUES
('math', '算数', '➕', 'けいさんや図形のもんだい', 'blue'),
('history', '歴史', '🏯', 'むかしの出来事や人物', 'orange'),
('science', '理科', '🔬', '生き物や自然のふしぎ', 'green');

-- 問題（算数のサンプル2問）
INSERT INTO public.questions (genre_id, question_text, options, correct_index, explanation) VALUES
('math', '15 + 27 はいくつでしょう？', '["32", "42", "52"]', 1, '1のくらいは 5+7=12。10のくらいに1くりあげて、1+2+1=4。だから42が正解だよ！'),
('math', '1日は何時間でしょう？', '["12時間", "20時間", "24時間"]', 2, '朝から夜、そして次の日の朝までぐるっと1周すると24時間だよ！');
