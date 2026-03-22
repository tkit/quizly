CREATE OR REPLACE FUNCTION public.complete_study_session(
  p_child_id uuid,
  p_genre_id text,
  p_mode text,
  p_total_questions integer,
  p_correct_count integer,
  p_earned_points integer,
  p_completed_at timestamptz,
  p_history_records jsonb DEFAULT '[]'::jsonb,
  p_point_transactions jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_session_id uuid;
BEGIN
  INSERT INTO public.study_sessions (
    child_id,
    genre_id,
    mode,
    total_questions,
    correct_count,
    earned_points,
    completed_at
  )
  VALUES (
    p_child_id,
    p_genre_id,
    p_mode,
    p_total_questions,
    p_correct_count,
    p_earned_points,
    p_completed_at
  )
  RETURNING id INTO v_session_id;

  INSERT INTO public.study_history (
    session_id,
    child_id,
    question_id,
    is_correct,
    selected_index
  )
  SELECT
    v_session_id,
    p_child_id,
    record.question_id,
    record.is_correct,
    record.selected_index
  FROM jsonb_to_recordset(COALESCE(p_history_records, '[]'::jsonb)) AS record(
    question_id uuid,
    is_correct boolean,
    selected_index integer
  );

  INSERT INTO public.point_transactions (
    child_id,
    session_id,
    points,
    reason
  )
  SELECT
    p_child_id,
    v_session_id,
    record.points,
    record.reason
  FROM jsonb_to_recordset(COALESCE(p_point_transactions, '[]'::jsonb)) AS record(
    points integer,
    reason text
  )
  WHERE record.points > 0;

  IF p_earned_points > 0 THEN
    UPDATE public.child_profiles
    SET total_points = total_points + p_earned_points
    WHERE id = p_child_id;
  END IF;

  RETURN v_session_id;
END;
$$;
