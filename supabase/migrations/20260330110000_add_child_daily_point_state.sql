CREATE TABLE public.child_daily_point_state (
  child_id uuid PRIMARY KEY REFERENCES public.child_profiles(id) ON DELETE CASCADE,
  state_date date NOT NULL,
  consecutive_correct_count integer NOT NULL DEFAULT 0,
  streak_bonus_count integer NOT NULL DEFAULT 0,
  daily_challenge_awarded boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.child_daily_point_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY child_daily_point_state_own_household_select ON public.child_daily_point_state
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.child_profiles cp
      WHERE cp.id = child_daily_point_state.child_id
        AND cp.guardian_id = auth.uid()
    )
  );

CREATE POLICY child_daily_point_state_own_household_insert ON public.child_daily_point_state
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.child_profiles cp
      WHERE cp.id = child_daily_point_state.child_id
        AND cp.guardian_id = auth.uid()
    )
  );

CREATE POLICY child_daily_point_state_own_household_update ON public.child_daily_point_state
  FOR UPDATE USING (
    EXISTS (
      SELECT 1
      FROM public.child_profiles cp
      WHERE cp.id = child_daily_point_state.child_id
        AND cp.guardian_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.child_profiles cp
      WHERE cp.id = child_daily_point_state.child_id
        AND cp.guardian_id = auth.uid()
    )
  );
