CREATE INDEX IF NOT EXISTS idx_study_sessions_child_genre
  ON public.study_sessions (child_id, genre_id);
