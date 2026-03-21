-- Rebuild auth/data model for guardian-centric flow (destructive)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DROP TABLE IF EXISTS public.point_transactions CASCADE;
DROP TABLE IF EXISTS public.study_history CASCADE;
DROP TABLE IF EXISTS public.study_sessions CASCADE;
DROP TABLE IF EXISTS public.questions CASCADE;
DROP TABLE IF EXISTS public.genres CASCADE;
DROP TABLE IF EXISTS public.child_profiles CASCADE;
DROP TABLE IF EXISTS public.parent_reauth_challenges CASCADE;
DROP TABLE IF EXISTS public.guardian_accounts CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

CREATE TABLE public.guardian_accounts (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.child_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guardian_id uuid NOT NULL REFERENCES public.guardian_accounts(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  avatar_url text,
  pin_hash text,
  auth_mode text NOT NULL DEFAULT 'none' CHECK (auth_mode IN ('none', 'pin')),
  total_points integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.parent_reauth_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guardian_id uuid NOT NULL REFERENCES public.guardian_accounts(id) ON DELETE CASCADE,
  verified_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.genres (
  id text PRIMARY KEY,
  name text NOT NULL,
  parent_id text REFERENCES public.genres(id),
  icon_key text NOT NULL,
  description text,
  color_hint text
);

CREATE TABLE public.questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  genre_id text NOT NULL REFERENCES public.genres(id),
  question_text text NOT NULL,
  options jsonb NOT NULL,
  correct_index integer NOT NULL,
  explanation text,
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.study_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES public.child_profiles(id) ON DELETE CASCADE,
  genre_id text REFERENCES public.genres(id),
  mode text NOT NULL DEFAULT 'normal',
  total_questions integer NOT NULL,
  correct_count integer NOT NULL,
  earned_points integer NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE public.study_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.study_sessions(id) ON DELETE CASCADE,
  child_id uuid NOT NULL REFERENCES public.child_profiles(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.questions(id),
  is_correct boolean NOT NULL,
  selected_index integer NOT NULL,
  answered_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.point_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES public.child_profiles(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.study_sessions(id) ON DELETE CASCADE,
  points integer NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_child_profiles_guardian_id ON public.child_profiles(guardian_id);
CREATE INDEX idx_study_sessions_child_id ON public.study_sessions(child_id);
CREATE INDEX idx_study_history_child_id ON public.study_history(child_id);
CREATE INDEX idx_point_transactions_child_id ON public.point_transactions(child_id);

ALTER TABLE public.guardian_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.child_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_reauth_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.genres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY guardian_accounts_select_own ON public.guardian_accounts
  FOR SELECT USING (id = auth.uid());
CREATE POLICY guardian_accounts_insert_own ON public.guardian_accounts
  FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY guardian_accounts_update_own ON public.guardian_accounts
  FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY child_profiles_own_household_select ON public.child_profiles
  FOR SELECT USING (guardian_id = auth.uid());
CREATE POLICY child_profiles_own_household_insert ON public.child_profiles
  FOR INSERT WITH CHECK (guardian_id = auth.uid());
CREATE POLICY child_profiles_own_household_update ON public.child_profiles
  FOR UPDATE USING (guardian_id = auth.uid()) WITH CHECK (guardian_id = auth.uid());
CREATE POLICY child_profiles_own_household_delete ON public.child_profiles
  FOR DELETE USING (guardian_id = auth.uid());

CREATE POLICY reauth_own_household ON public.parent_reauth_challenges
  FOR ALL USING (guardian_id = auth.uid()) WITH CHECK (guardian_id = auth.uid());

CREATE POLICY genres_read_all ON public.genres
  FOR SELECT USING (true);

CREATE POLICY questions_read_all ON public.questions
  FOR SELECT USING (true);

CREATE POLICY study_sessions_own_household_select ON public.study_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.child_profiles cp
      WHERE cp.id = study_sessions.child_id
        AND cp.guardian_id = auth.uid()
    )
  );
CREATE POLICY study_sessions_own_household_insert ON public.study_sessions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.child_profiles cp
      WHERE cp.id = study_sessions.child_id
        AND cp.guardian_id = auth.uid()
    )
  );

CREATE POLICY study_history_own_household_select ON public.study_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.child_profiles cp
      WHERE cp.id = study_history.child_id
        AND cp.guardian_id = auth.uid()
    )
  );
CREATE POLICY study_history_own_household_insert ON public.study_history
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.child_profiles cp
      WHERE cp.id = study_history.child_id
        AND cp.guardian_id = auth.uid()
    )
  );

CREATE POLICY point_transactions_own_household_select ON public.point_transactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.child_profiles cp
      WHERE cp.id = point_transactions.child_id
        AND cp.guardian_id = auth.uid()
    )
  );
CREATE POLICY point_transactions_own_household_insert ON public.point_transactions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.child_profiles cp
      WHERE cp.id = point_transactions.child_id
        AND cp.guardian_id = auth.uid()
    )
  );

-- Public learning catalog seeds
INSERT INTO public.genres (id, name, parent_id, icon_key, description, color_hint) VALUES
('math', '算数', NULL, 'calculator', '計算や図形の基礎を学ぶ', 'blue'),
('japanese', '国語', NULL, 'book_open', 'ことばや文の読み書き', 'pink'),
('social', '社会', NULL, 'map', '地理や歴史の基礎を学ぶ', 'orange'),
('science', '理科', NULL, 'microscope', '自然や科学のしくみを学ぶ', 'green'),
('math-basic-calc', '計算マスター', 'math', 'calculator', '四則計算の基礎を身につける', 'blue'),
('math-time', '時間と時計', 'math', 'clock', '時刻の読み取りと時間計算を学ぶ', 'blue'),
('jp-grammar-01', '文法マスター 第1回: 和語(1)', 'japanese', 'notebook', '和語の意味と使い方', 'pink'),
('jp-grammar-02', '文法マスター 第2回: 慣用句(1)', 'japanese', 'message', '慣用句の読み取り', 'pink');

INSERT INTO public.questions (genre_id, question_text, options, correct_index, explanation) VALUES
('math-basic-calc', '15 + 27 はいくつですか？', '["32", "42", "52"]', 1, '1の位は 5+7=12 です。2を残して1を十の位に繰り上げると、十の位は 1+2+1=4 なので、答えは42です。'),
('math-time', '1日は何時間ですか？', '["12時間", "20時間", "24時間"]', 2, '1日は24時間です。'),
('jp-grammar-01', '「山道」を読むとき、正しいのはどれ？', '["やまみち", "さんどう", "やまどう"]', 0, '和語として読む場合は「やまみち」が正解です。'),
('jp-grammar-02', '「あしをひっぱる」の意味として正しいのはどれ？', '["協力して助ける", "じゃまをする", "走るのが速い"]', 1, '慣用句「あしをひっぱる」は、じゃまをするという意味です。');
