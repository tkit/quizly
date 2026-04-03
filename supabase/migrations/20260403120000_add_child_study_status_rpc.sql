CREATE OR REPLACE FUNCTION public.get_child_study_status(p_child_id uuid)
RETURNS TABLE (
  genre_id text,
  study_status text
)
LANGUAGE sql
SET search_path = public
AS $$
  SELECT
    ss.genre_id,
    CASE
      WHEN bool_or(ss.total_questions > 0 AND ss.correct_count = ss.total_questions) THEN 'perfect_cleared'
      ELSE 'studied_not_perfect'
    END AS study_status
  FROM public.study_sessions ss
  WHERE ss.child_id = p_child_id
    AND ss.genre_id IS NOT NULL
  GROUP BY ss.genre_id
$$;
