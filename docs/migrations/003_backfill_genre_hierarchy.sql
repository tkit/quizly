-- =============================================
-- Backfill migration for existing flat genres data
-- Safe for existing production/dev data (idempotent)
-- =============================================

BEGIN;

-- 1) Add parent_id if missing
ALTER TABLE public.genres
  ADD COLUMN IF NOT EXISTS parent_id text REFERENCES public.genres(id);

CREATE INDEX IF NOT EXISTS idx_genres_parent_id ON public.genres(parent_id);

ALTER TABLE public.genres
  DROP CONSTRAINT IF EXISTS genres_parent_not_self;

ALTER TABLE public.genres
  ADD CONSTRAINT genres_parent_not_self CHECK (id <> parent_id);

-- 2) Ensure parent genres exist (keep existing rows as parent)
INSERT INTO public.genres (id, name, parent_id, icon, description, color_hint)
VALUES
  ('math', '算数', NULL, '➕', 'けいさんや図形のもんだい', 'blue'),
  ('history', '歴史', NULL, '🏯', 'むかしの出来事や人物', 'orange'),
  ('science', '理科', NULL, '🔬', '生き物や自然のふしぎ', 'green')
ON CONFLICT (id) DO UPDATE SET
  parent_id = NULL,
  name = EXCLUDED.name;

-- 3) Create default child genres for existing top-level genres
INSERT INTO public.genres (id, name, parent_id, icon, description, color_hint)
VALUES
  ('math-basic', '算数ベーシック', 'math', '🧮', '算数のきそ問題', 'blue'),
  ('history-basic', '歴史ベーシック', 'history', '📜', '歴史のきそ問題', 'orange'),
  ('science-basic', '理科ベーシック', 'science', '🧪', '理科のきそ問題', 'green')
ON CONFLICT (id) DO UPDATE SET
  parent_id = EXCLUDED.parent_id,
  name = EXCLUDED.name;

-- 4) Migrate existing questions from parent genre -> default child genre
UPDATE public.questions SET genre_id = 'math-basic' WHERE genre_id = 'math';
UPDATE public.questions SET genre_id = 'history-basic' WHERE genre_id = 'history';
UPDATE public.questions SET genre_id = 'science-basic' WHERE genre_id = 'science';

-- 5) Migrate existing sessions too (so retry flow keeps working)
UPDATE public.study_sessions SET genre_id = 'math-basic' WHERE genre_id = 'math';
UPDATE public.study_sessions SET genre_id = 'history-basic' WHERE genre_id = 'history';
UPDATE public.study_sessions SET genre_id = 'science-basic' WHERE genre_id = 'science';

-- 6) Optional: add Japanese subject and sample subcategories
INSERT INTO public.genres (id, name, parent_id, icon, description, color_hint)
VALUES
  ('japanese', '国語', NULL, '📖', 'ことばや文の読み書き', 'pink'),
  ('jp-grammar-01', '文法マスター 第1回: 和語(1)', 'japanese', '📝', '和語の意味と使い方', 'pink'),
  ('jp-grammar-02', '文法マスター 第2回: 慣用句(1)', 'japanese', '💬', '慣用句の読み取り', 'pink')
ON CONFLICT (id) DO NOTHING;

COMMIT;
