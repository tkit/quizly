CREATE OR REPLACE FUNCTION public.get_active_question_counts()
RETURNS TABLE (
  genre_id text,
  question_count bigint
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    questions.genre_id,
    COUNT(*) AS question_count
  FROM public.questions
  WHERE questions.is_active = true
  GROUP BY questions.genre_id;
$$;
