CREATE TABLE public.badge_definitions (
  key text PRIMARY KEY,
  family text NOT NULL,
  level integer,
  name text NOT NULL,
  icon_path text NOT NULL,
  is_secret boolean NOT NULL DEFAULT false,
  condition_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.child_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES public.child_profiles(id) ON DELETE CASCADE,
  badge_key text NOT NULL REFERENCES public.badge_definitions(key) ON DELETE CASCADE,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  session_id uuid REFERENCES public.study_sessions(id) ON DELETE SET NULL,
  latest_progress integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (child_id, badge_key)
);

CREATE TABLE public.badge_unlock_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES public.child_profiles(id) ON DELETE CASCADE,
  badge_key text NOT NULL REFERENCES public.badge_definitions(key) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.study_sessions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.child_streak_state (
  child_id uuid PRIMARY KEY REFERENCES public.child_profiles(id) ON DELETE CASCADE,
  current_streak_days integer NOT NULL DEFAULT 0,
  longest_streak_days integer NOT NULL DEFAULT 0,
  last_studied_date date,
  weekly_shield_count integer NOT NULL DEFAULT 1,
  shield_week_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_badge_definitions_family ON public.badge_definitions(family, sort_order);
CREATE INDEX idx_child_badges_child_id ON public.child_badges(child_id, unlocked_at DESC);
CREATE INDEX idx_badge_unlock_events_child_id ON public.badge_unlock_events(child_id, created_at DESC);

ALTER TABLE public.badge_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.child_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badge_unlock_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.child_streak_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY badge_definitions_read_all ON public.badge_definitions
  FOR SELECT USING (true);

CREATE POLICY child_badges_own_household_select ON public.child_badges
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.child_profiles cp
      WHERE cp.id = child_badges.child_id
        AND cp.guardian_id = auth.uid()
    )
  );

CREATE POLICY child_badges_own_household_insert ON public.child_badges
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.child_profiles cp
      WHERE cp.id = child_badges.child_id
        AND cp.guardian_id = auth.uid()
    )
  );

CREATE POLICY badge_unlock_events_own_household_select ON public.badge_unlock_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.child_profiles cp
      WHERE cp.id = badge_unlock_events.child_id
        AND cp.guardian_id = auth.uid()
    )
  );

CREATE POLICY badge_unlock_events_own_household_insert ON public.badge_unlock_events
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.child_profiles cp
      WHERE cp.id = badge_unlock_events.child_id
        AND cp.guardian_id = auth.uid()
    )
  );

CREATE POLICY child_streak_state_own_household_select ON public.child_streak_state
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.child_profiles cp
      WHERE cp.id = child_streak_state.child_id
        AND cp.guardian_id = auth.uid()
    )
  );

CREATE POLICY child_streak_state_own_household_insert ON public.child_streak_state
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.child_profiles cp
      WHERE cp.id = child_streak_state.child_id
        AND cp.guardian_id = auth.uid()
    )
  );

CREATE POLICY child_streak_state_own_household_update ON public.child_streak_state
  FOR UPDATE USING (
    EXISTS (
      SELECT 1
      FROM public.child_profiles cp
      WHERE cp.id = child_streak_state.child_id
        AND cp.guardian_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.child_profiles cp
      WHERE cp.id = child_streak_state.child_id
        AND cp.guardian_id = auth.uid()
    )
  );

INSERT INTO public.badge_definitions (key, family, level, name, icon_path, is_secret, condition_json, sort_order) VALUES
('streak_days_l1', 'streak_days', 1, '継続学習 1', '/badges/64/badge_streak_days_l1.png', false, '{"threshold":3}'::jsonb, 10),
('streak_days_l2', 'streak_days', 2, '継続学習 2', '/badges/64/badge_streak_days_l2.png', false, '{"threshold":7}'::jsonb, 20),
('streak_days_l3', 'streak_days', 3, '継続学習 3', '/badges/64/badge_streak_days_l3.png', false, '{"threshold":14}'::jsonb, 30),
('streak_days_l4', 'streak_days', 4, '継続学習 4', '/badges/64/badge_streak_days_l4.png', false, '{"threshold":21}'::jsonb, 40),
('streak_days_l5', 'streak_days', 5, '継続学習 5', '/badges/64/badge_streak_days_l5.png', false, '{"threshold":30}'::jsonb, 50),

('perfect_sessions_l1', 'perfect_sessions', 1, 'パーフェクト 1', '/badges/64/badge_perfect_sessions_l1.png', false, '{"threshold":1}'::jsonb, 110),
('perfect_sessions_l2', 'perfect_sessions', 2, 'パーフェクト 2', '/badges/64/badge_perfect_sessions_l2.png', false, '{"threshold":3}'::jsonb, 120),
('perfect_sessions_l3', 'perfect_sessions', 3, 'パーフェクト 3', '/badges/64/badge_perfect_sessions_l3.png', false, '{"threshold":5}'::jsonb, 130),
('perfect_sessions_l4', 'perfect_sessions', 4, 'パーフェクト 4', '/badges/64/badge_perfect_sessions_l4.png', false, '{"threshold":10}'::jsonb, 140),
('perfect_sessions_l5', 'perfect_sessions', 5, 'パーフェクト 5', '/badges/64/badge_perfect_sessions_l5.png', false, '{"threshold":20}'::jsonb, 150),

('genre_explorer_l1', 'genre_explorer', 1, 'ジャンル探検 1', '/badges/64/badge_genre_explorer_l1.png', false, '{"threshold":2}'::jsonb, 210),
('genre_explorer_l2', 'genre_explorer', 2, 'ジャンル探検 2', '/badges/64/badge_genre_explorer_l2.png', false, '{"threshold":4}'::jsonb, 220),
('genre_explorer_l3', 'genre_explorer', 3, 'ジャンル探検 3', '/badges/64/badge_genre_explorer_l3.png', false, '{"threshold":6}'::jsonb, 230),
('genre_explorer_l4', 'genre_explorer', 4, 'ジャンル探検 4', '/badges/64/badge_genre_explorer_l4.png', false, '{"threshold":9}'::jsonb, 240),
('genre_explorer_l5', 'genre_explorer', 5, 'ジャンル探検 5', '/badges/64/badge_genre_explorer_l5.png', false, '{"threshold":12}'::jsonb, 250),

('subject_master_japanese_l1', 'subject_master', 1, '国語マスター 1', '/badges/64/badge_subject_master_japanese_l1.png', false, '{"subject_id":"japanese","threshold":3}'::jsonb, 310),
('subject_master_japanese_l2', 'subject_master', 2, '国語マスター 2', '/badges/64/badge_subject_master_japanese_l2.png', false, '{"subject_id":"japanese","threshold":7}'::jsonb, 320),
('subject_master_japanese_l3', 'subject_master', 3, '国語マスター 3', '/badges/64/badge_subject_master_japanese_l3.png', false, '{"subject_id":"japanese","threshold":14}'::jsonb, 330),
('subject_master_japanese_l4', 'subject_master', 4, '国語マスター 4', '/badges/64/badge_subject_master_japanese_l4.png', false, '{"subject_id":"japanese","threshold":21}'::jsonb, 340),
('subject_master_japanese_l5', 'subject_master', 5, '国語マスター 5', '/badges/64/badge_subject_master_japanese_l5.png', false, '{"subject_id":"japanese","threshold":30}'::jsonb, 350),

('subject_master_math_l1', 'subject_master', 1, '算数マスター 1', '/badges/64/badge_subject_master_math_l1.png', false, '{"subject_id":"math","threshold":3}'::jsonb, 360),
('subject_master_math_l2', 'subject_master', 2, '算数マスター 2', '/badges/64/badge_subject_master_math_l2.png', false, '{"subject_id":"math","threshold":7}'::jsonb, 370),
('subject_master_math_l3', 'subject_master', 3, '算数マスター 3', '/badges/64/badge_subject_master_math_l3.png', false, '{"subject_id":"math","threshold":14}'::jsonb, 380),
('subject_master_math_l4', 'subject_master', 4, '算数マスター 4', '/badges/64/badge_subject_master_math_l4.png', false, '{"subject_id":"math","threshold":21}'::jsonb, 390),
('subject_master_math_l5', 'subject_master', 5, '算数マスター 5', '/badges/64/badge_subject_master_math_l5.png', false, '{"subject_id":"math","threshold":30}'::jsonb, 400),

('subject_master_science_l1', 'subject_master', 1, '理科マスター 1', '/badges/64/badge_subject_master_science_l1.png', false, '{"subject_id":"science","threshold":3}'::jsonb, 410),
('subject_master_science_l2', 'subject_master', 2, '理科マスター 2', '/badges/64/badge_subject_master_science_l2.png', false, '{"subject_id":"science","threshold":7}'::jsonb, 420),
('subject_master_science_l3', 'subject_master', 3, '理科マスター 3', '/badges/64/badge_subject_master_science_l3.png', false, '{"subject_id":"science","threshold":14}'::jsonb, 430),
('subject_master_science_l4', 'subject_master', 4, '理科マスター 4', '/badges/64/badge_subject_master_science_l4.png', false, '{"subject_id":"science","threshold":21}'::jsonb, 440),
('subject_master_science_l5', 'subject_master', 5, '理科マスター 5', '/badges/64/badge_subject_master_science_l5.png', false, '{"subject_id":"science","threshold":30}'::jsonb, 450),

('subject_master_social_l1', 'subject_master', 1, '社会マスター 1', '/badges/64/badge_subject_master_social_l1.png', false, '{"subject_id":"social","threshold":3}'::jsonb, 460),
('subject_master_social_l2', 'subject_master', 2, '社会マスター 2', '/badges/64/badge_subject_master_social_l2.png', false, '{"subject_id":"social","threshold":7}'::jsonb, 470),
('subject_master_social_l3', 'subject_master', 3, '社会マスター 3', '/badges/64/badge_subject_master_social_l3.png', false, '{"subject_id":"social","threshold":14}'::jsonb, 480),
('subject_master_social_l4', 'subject_master', 4, '社会マスター 4', '/badges/64/badge_subject_master_social_l4.png', false, '{"subject_id":"social","threshold":21}'::jsonb, 490),
('subject_master_social_l5', 'subject_master', 5, '社会マスター 5', '/badges/64/badge_subject_master_social_l5.png', false, '{"subject_id":"social","threshold":30}'::jsonb, 500),

('secret_comeback', 'secret', NULL, '再開バッジ', '/badges/64/badge_secret_comeback.png', true, '{"type":"comeback"}'::jsonb, 910),
('secret_perfect_recovery', 'secret', NULL, 'リカバリーバッジ', '/badges/64/badge_secret_perfect_recovery.png', true, '{"type":"perfect_recovery"}'::jsonb, 920);

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
    WHERE id = p_child_id;
  END IF;

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
