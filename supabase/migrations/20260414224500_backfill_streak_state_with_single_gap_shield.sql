-- Recalculate child_streak_state from historical study_sessions.
-- Rule: shield can cover exactly one missed day (date diff = 2) once per ISO week.
DO $$
DECLARE
  v_child_id uuid;
  v_study_dates date[];
  v_date date;
  v_prev_date date;
  v_last_date date;
  v_gap integer;
  v_week_key text;
  v_shield_week_key text;
  v_current_streak integer;
  v_longest_streak integer;
  v_weekly_shield_count integer;
BEGIN
  FOR v_child_id IN
    SELECT id
    FROM public.child_profiles
  LOOP
    SELECT COALESCE(array_agg(study_date ORDER BY study_date), ARRAY[]::date[])
    INTO v_study_dates
    FROM (
      SELECT DISTINCT (COALESCE(completed_at, started_at) AT TIME ZONE 'Asia/Tokyo')::date AS study_date
      FROM public.study_sessions
      WHERE child_id = v_child_id
    ) AS daily_sessions;

    v_prev_date := NULL;
    v_last_date := NULL;
    v_shield_week_key := NULL;
    v_current_streak := 0;
    v_longest_streak := 0;
    v_weekly_shield_count := 1;

    FOREACH v_date IN ARRAY v_study_dates
    LOOP
      v_week_key := to_char(v_date::timestamp, 'IYYY-IW');

      IF v_shield_week_key IS DISTINCT FROM v_week_key THEN
        v_weekly_shield_count := 1;
        v_shield_week_key := v_week_key;
      END IF;

      IF v_prev_date IS NULL THEN
        v_current_streak := 1;
      ELSE
        v_gap := v_date - v_prev_date;

        IF v_gap <= 0 THEN
          v_current_streak := v_current_streak;
        ELSIF v_gap = 1 THEN
          v_current_streak := v_current_streak + 1;
        ELSIF v_gap = 2 AND v_weekly_shield_count > 0 THEN
          v_current_streak := v_current_streak + 1;
          v_weekly_shield_count := v_weekly_shield_count - 1;
        ELSE
          v_current_streak := 1;
        END IF;
      END IF;

      IF v_current_streak > v_longest_streak THEN
        v_longest_streak := v_current_streak;
      END IF;

      v_prev_date := v_date;
      v_last_date := v_date;
    END LOOP;

    INSERT INTO public.child_streak_state (
      child_id,
      current_streak_days,
      longest_streak_days,
      last_studied_date,
      weekly_shield_count,
      shield_week_key,
      created_at,
      updated_at
    )
    VALUES (
      v_child_id,
      v_current_streak,
      v_longest_streak,
      v_last_date,
      CASE WHEN v_last_date IS NULL THEN 1 ELSE v_weekly_shield_count END,
      CASE WHEN v_last_date IS NULL THEN NULL ELSE v_shield_week_key END,
      now(),
      now()
    )
    ON CONFLICT (child_id)
    DO UPDATE SET
      current_streak_days = EXCLUDED.current_streak_days,
      longest_streak_days = EXCLUDED.longest_streak_days,
      last_studied_date = EXCLUDED.last_studied_date,
      weekly_shield_count = EXCLUDED.weekly_shield_count,
      shield_week_key = EXCLUDED.shield_week_key,
      updated_at = now();
  END LOOP;
END
$$;
