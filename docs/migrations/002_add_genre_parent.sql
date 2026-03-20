-- =============================================
-- Genre Hierarchy Migration (Todo #3)
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. Add parent_id to genres for 2-level hierarchy
ALTER TABLE public.genres
  ADD COLUMN IF NOT EXISTS parent_id text REFERENCES public.genres(id);

-- 2. Performance index for parent -> children lookup
CREATE INDEX IF NOT EXISTS idx_genres_parent_id ON public.genres(parent_id);

-- 3. Keep data valid for 2-level operation (no self-parent)
ALTER TABLE public.genres
  DROP CONSTRAINT IF EXISTS genres_parent_not_self;

ALTER TABLE public.genres
  ADD CONSTRAINT genres_parent_not_self CHECK (id <> parent_id);
