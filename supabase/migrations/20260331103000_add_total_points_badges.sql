INSERT INTO public.badge_definitions (key, family, level, name, icon_path, is_secret, condition_json, sort_order)
VALUES
  ('total_points_l1', 'total_points', 1, 'ポイントの種', '/badges-arcade/svg/badge_total_points_l1.svg', false, '{"threshold":100}'::jsonb, 260),
  ('total_points_l2', 'total_points', 2, 'ポイントの芽', '/badges-arcade/svg/badge_total_points_l2.svg', false, '{"threshold":500}'::jsonb, 270),
  ('total_points_l3', 'total_points', 3, 'ポイントの若木', '/badges-arcade/svg/badge_total_points_l3.svg', false, '{"threshold":1500}'::jsonb, 280),
  ('total_points_l4', 'total_points', 4, 'ポイントの大樹', '/badges-arcade/svg/badge_total_points_l4.svg', false, '{"threshold":5000}'::jsonb, 290),
  ('total_points_l5', 'total_points', 5, 'ポイントの銀河', '/badges-arcade/svg/badge_total_points_l5.svg', false, '{"threshold":10000}'::jsonb, 300)
ON CONFLICT (key) DO UPDATE
SET
  family = EXCLUDED.family,
  level = EXCLUDED.level,
  name = EXCLUDED.name,
  icon_path = EXCLUDED.icon_path,
  is_secret = EXCLUDED.is_secret,
  condition_json = EXCLUDED.condition_json,
  is_active = true,
  sort_order = EXCLUDED.sort_order;

DROP FUNCTION IF EXISTS public.complete_study_session(uuid, text, text, integer, integer, integer, timestamptz, jsonb, jsonb);

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
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_session_id uuid;
  v_unlocked_badges jsonb := '[]'::jsonb;
  v_added_badges jsonb := '[]'::jsonb;

  v_today_jst date;
  v_week_key text;
  v_prev_studied_date date;
  v_prev_session_perfect boolean;
  v_current_session_perfect boolean;

  v_current_streak_days integer;
  v_longest_streak_days integer;
  v_last_studied_date date;
  v_weekly_shield_count integer;
  v_shield_week_key text;

  v_perfect_session_count integer;
  v_genre_explorer_count integer;
  v_total_points integer;
  v_subject_session_count integer;
  v_subject_key text;
BEGIN
  v_today_jst := (p_completed_at AT TIME ZONE 'Asia/Tokyo')::date;
  v_week_key := to_char(v_today_jst::timestamp, 'IYYY-IW');
  v_current_session_perfect := p_total_questions > 0 AND p_correct_count = p_total_questions;

  SELECT
    (COALESCE(completed_at, started_at) AT TIME ZONE 'Asia/Tokyo')::date,
    (total_questions > 0 AND correct_count = total_questions)
  INTO
    v_prev_studied_date,
    v_prev_session_perfect
  FROM public.study_sessions
  WHERE child_id = p_child_id
  ORDER BY COALESCE(completed_at, started_at) DESC, id DESC
  LIMIT 1;

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
    WHERE id = p_child_id
    RETURNING total_points INTO v_total_points;
  ELSE
    SELECT total_points
    INTO v_total_points
    FROM public.child_profiles
    WHERE id = p_child_id;
  END IF;

  v_total_points := COALESCE(v_total_points, 0);

  SELECT
    current_streak_days,
    longest_streak_days,
    last_studied_date,
    weekly_shield_count,
    shield_week_key
  INTO
    v_current_streak_days,
    v_longest_streak_days,
    v_last_studied_date,
    v_weekly_shield_count,
    v_shield_week_key
  FROM public.child_streak_state
  WHERE child_id = p_child_id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.child_streak_state (
      child_id,
      current_streak_days,
      longest_streak_days,
      last_studied_date,
      weekly_shield_count,
      shield_week_key
    )
    VALUES (
      p_child_id,
      0,
      0,
      NULL,
      1,
      v_week_key
    );

    SELECT
      current_streak_days,
      longest_streak_days,
      last_studied_date,
      weekly_shield_count,
      shield_week_key
    INTO
      v_current_streak_days,
      v_longest_streak_days,
      v_last_studied_date,
      v_weekly_shield_count,
      v_shield_week_key
    FROM public.child_streak_state
    WHERE child_id = p_child_id
    FOR UPDATE;
  END IF;

  IF v_shield_week_key IS DISTINCT FROM v_week_key THEN
    v_weekly_shield_count := 1;
    v_shield_week_key := v_week_key;
  END IF;

  IF v_last_studied_date IS NULL THEN
    v_current_streak_days := 1;
  ELSIF v_today_jst <= v_last_studied_date THEN
    v_current_streak_days := v_current_streak_days;
  ELSIF (v_today_jst - v_last_studied_date) = 1 THEN
    v_current_streak_days := v_current_streak_days + 1;
  ELSIF (v_today_jst - v_last_studied_date) > 1 AND v_weekly_shield_count > 0 THEN
    v_current_streak_days := v_current_streak_days + 1;
    v_weekly_shield_count := v_weekly_shield_count - 1;
  ELSE
    v_current_streak_days := 1;
  END IF;

  IF v_current_streak_days > v_longest_streak_days THEN
    v_longest_streak_days := v_current_streak_days;
  END IF;

  UPDATE public.child_streak_state
  SET
    current_streak_days = v_current_streak_days,
    longest_streak_days = v_longest_streak_days,
    last_studied_date = GREATEST(COALESCE(last_studied_date, v_today_jst), v_today_jst),
    weekly_shield_count = v_weekly_shield_count,
    shield_week_key = v_shield_week_key,
    updated_at = now()
  WHERE child_id = p_child_id;

  SELECT COUNT(*)::integer
  INTO v_perfect_session_count
  FROM public.study_sessions
  WHERE child_id = p_child_id
    AND total_questions > 0
    AND correct_count = total_questions;

  SELECT COUNT(DISTINCT genre_id)::integer
  INTO v_genre_explorer_count
  FROM public.study_sessions
  WHERE child_id = p_child_id
    AND genre_id IS NOT NULL;

  SELECT COALESCE(parent_id, id)
  INTO v_subject_key
  FROM public.genres
  WHERE id = p_genre_id
  LIMIT 1;

  v_subject_key := COALESCE(v_subject_key, p_genre_id);

  SELECT COUNT(*)::integer
  INTO v_subject_session_count
  FROM public.study_sessions ss
  JOIN public.genres g ON g.id = ss.genre_id
  WHERE ss.child_id = p_child_id
    AND COALESCE(g.parent_id, g.id) = v_subject_key;

  WITH candidates AS (
    SELECT key
    FROM public.badge_definitions
    WHERE is_active = true
      AND family = 'streak_days'
      AND is_secret = false
      AND COALESCE((condition_json ->> 'threshold')::integer, 0) <= v_current_streak_days
  ),
  inserted AS (
    INSERT INTO public.child_badges (child_id, badge_key, unlocked_at, session_id, latest_progress)
    SELECT p_child_id, key, p_completed_at, v_session_id, v_current_streak_days
    FROM candidates
    ON CONFLICT (child_id, badge_key) DO NOTHING
    RETURNING badge_key
  )
  INSERT INTO public.badge_unlock_events (child_id, badge_key, session_id, created_at)
  SELECT p_child_id, badge_key, v_session_id, p_completed_at
  FROM inserted;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'key', bd.key,
        'name', bd.name,
        'icon_path', bd.icon_path,
        'is_secret', bd.is_secret
      )
    ),
    '[]'::jsonb
  )
  INTO v_added_badges
  FROM public.child_badges cb
  JOIN public.badge_definitions bd ON bd.key = cb.badge_key
  WHERE cb.child_id = p_child_id
    AND cb.session_id = v_session_id
    AND bd.family = 'streak_days';
  v_unlocked_badges := v_unlocked_badges || v_added_badges;

  WITH candidates AS (
    SELECT key
    FROM public.badge_definitions
    WHERE is_active = true
      AND family = 'perfect_sessions'
      AND is_secret = false
      AND COALESCE((condition_json ->> 'threshold')::integer, 0) <= v_perfect_session_count
  ),
  inserted AS (
    INSERT INTO public.child_badges (child_id, badge_key, unlocked_at, session_id, latest_progress)
    SELECT p_child_id, key, p_completed_at, v_session_id, v_perfect_session_count
    FROM candidates
    ON CONFLICT (child_id, badge_key) DO NOTHING
    RETURNING badge_key
  )
  INSERT INTO public.badge_unlock_events (child_id, badge_key, session_id, created_at)
  SELECT p_child_id, badge_key, v_session_id, p_completed_at
  FROM inserted;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'key', bd.key,
        'name', bd.name,
        'icon_path', bd.icon_path,
        'is_secret', bd.is_secret
      )
    ),
    '[]'::jsonb
  )
  INTO v_added_badges
  FROM public.child_badges cb
  JOIN public.badge_definitions bd ON bd.key = cb.badge_key
  WHERE cb.child_id = p_child_id
    AND cb.session_id = v_session_id
    AND bd.family = 'perfect_sessions';
  v_unlocked_badges := v_unlocked_badges || v_added_badges;

  WITH candidates AS (
    SELECT key
    FROM public.badge_definitions
    WHERE is_active = true
      AND family = 'genre_explorer'
      AND is_secret = false
      AND COALESCE((condition_json ->> 'threshold')::integer, 0) <= v_genre_explorer_count
  ),
  inserted AS (
    INSERT INTO public.child_badges (child_id, badge_key, unlocked_at, session_id, latest_progress)
    SELECT p_child_id, key, p_completed_at, v_session_id, v_genre_explorer_count
    FROM candidates
    ON CONFLICT (child_id, badge_key) DO NOTHING
    RETURNING badge_key
  )
  INSERT INTO public.badge_unlock_events (child_id, badge_key, session_id, created_at)
  SELECT p_child_id, badge_key, v_session_id, p_completed_at
  FROM inserted;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'key', bd.key,
        'name', bd.name,
        'icon_path', bd.icon_path,
        'is_secret', bd.is_secret
      )
    ),
    '[]'::jsonb
  )
  INTO v_added_badges
  FROM public.child_badges cb
  JOIN public.badge_definitions bd ON bd.key = cb.badge_key
  WHERE cb.child_id = p_child_id
    AND cb.session_id = v_session_id
    AND bd.family = 'genre_explorer';
  v_unlocked_badges := v_unlocked_badges || v_added_badges;

  WITH candidates AS (
    SELECT key
    FROM public.badge_definitions
    WHERE is_active = true
      AND family = 'total_points'
      AND is_secret = false
      AND COALESCE((condition_json ->> 'threshold')::integer, 0) <= v_total_points
  ),
  inserted AS (
    INSERT INTO public.child_badges (child_id, badge_key, unlocked_at, session_id, latest_progress)
    SELECT p_child_id, key, p_completed_at, v_session_id, v_total_points
    FROM candidates
    ON CONFLICT (child_id, badge_key) DO NOTHING
    RETURNING badge_key
  )
  INSERT INTO public.badge_unlock_events (child_id, badge_key, session_id, created_at)
  SELECT p_child_id, badge_key, v_session_id, p_completed_at
  FROM inserted;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'key', bd.key,
        'name', bd.name,
        'icon_path', bd.icon_path,
        'is_secret', bd.is_secret
      )
    ),
    '[]'::jsonb
  )
  INTO v_added_badges
  FROM public.child_badges cb
  JOIN public.badge_definitions bd ON bd.key = cb.badge_key
  WHERE cb.child_id = p_child_id
    AND cb.session_id = v_session_id
    AND bd.family = 'total_points';
  v_unlocked_badges := v_unlocked_badges || v_added_badges;

  WITH candidates AS (
    SELECT key
    FROM public.badge_definitions
    WHERE is_active = true
      AND family = 'subject_master'
      AND is_secret = false
      AND condition_json ->> 'subject_id' = v_subject_key
      AND COALESCE((condition_json ->> 'threshold')::integer, 0) <= v_subject_session_count
  ),
  inserted AS (
    INSERT INTO public.child_badges (child_id, badge_key, unlocked_at, session_id, latest_progress)
    SELECT p_child_id, key, p_completed_at, v_session_id, v_subject_session_count
    FROM candidates
    ON CONFLICT (child_id, badge_key) DO NOTHING
    RETURNING badge_key
  )
  INSERT INTO public.badge_unlock_events (child_id, badge_key, session_id, created_at)
  SELECT p_child_id, badge_key, v_session_id, p_completed_at
  FROM inserted;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'key', bd.key,
        'name', bd.name,
        'icon_path', bd.icon_path,
        'is_secret', bd.is_secret
      )
    ),
    '[]'::jsonb
  )
  INTO v_added_badges
  FROM public.child_badges cb
  JOIN public.badge_definitions bd ON bd.key = cb.badge_key
  WHERE cb.child_id = p_child_id
    AND cb.session_id = v_session_id
    AND bd.family = 'subject_master';
  v_unlocked_badges := v_unlocked_badges || v_added_badges;

  IF v_prev_studied_date IS NOT NULL AND (v_today_jst - v_prev_studied_date) >= 3 THEN
    INSERT INTO public.child_badges (child_id, badge_key, unlocked_at, session_id, latest_progress)
    VALUES (p_child_id, 'secret_comeback', p_completed_at, v_session_id, 1)
    ON CONFLICT (child_id, badge_key) DO NOTHING;

    IF FOUND THEN
      INSERT INTO public.badge_unlock_events (child_id, badge_key, session_id, created_at)
      VALUES (p_child_id, 'secret_comeback', v_session_id, p_completed_at);

      SELECT v_unlocked_badges || jsonb_build_array(
        jsonb_build_object(
          'key', key,
          'name', name,
          'icon_path', icon_path,
          'is_secret', is_secret
        )
      )
      INTO v_unlocked_badges
      FROM public.badge_definitions
      WHERE key = 'secret_comeback';
    END IF;
  END IF;

  IF v_current_session_perfect AND v_prev_session_perfect IS NOT NULL AND NOT v_prev_session_perfect THEN
    INSERT INTO public.child_badges (child_id, badge_key, unlocked_at, session_id, latest_progress)
    VALUES (p_child_id, 'secret_perfect_recovery', p_completed_at, v_session_id, 1)
    ON CONFLICT (child_id, badge_key) DO NOTHING;

    IF FOUND THEN
      INSERT INTO public.badge_unlock_events (child_id, badge_key, session_id, created_at)
      VALUES (p_child_id, 'secret_perfect_recovery', v_session_id, p_completed_at);

      SELECT v_unlocked_badges || jsonb_build_array(
        jsonb_build_object(
          'key', key,
          'name', name,
          'icon_path', icon_path,
          'is_secret', is_secret
        )
      )
      INTO v_unlocked_badges
      FROM public.badge_definitions
      WHERE key = 'secret_perfect_recovery';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'sessionId', v_session_id,
    'unlockedBadges', v_unlocked_badges
  );
END;
$$;
