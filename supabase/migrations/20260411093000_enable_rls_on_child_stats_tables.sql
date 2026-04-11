ALTER TABLE public.child_learning_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.child_genre_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.child_subject_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS child_learning_stats_own_household_select ON public.child_learning_stats;
DROP POLICY IF EXISTS child_learning_stats_own_household_insert ON public.child_learning_stats;
DROP POLICY IF EXISTS child_learning_stats_own_household_update ON public.child_learning_stats;

CREATE POLICY child_learning_stats_own_household_select ON public.child_learning_stats
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.child_profiles cp
      WHERE cp.id = child_learning_stats.child_id
        AND cp.guardian_id = auth.uid()
    )
  );

CREATE POLICY child_learning_stats_own_household_insert ON public.child_learning_stats
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.child_profiles cp
      WHERE cp.id = child_learning_stats.child_id
        AND cp.guardian_id = auth.uid()
    )
  );

CREATE POLICY child_learning_stats_own_household_update ON public.child_learning_stats
  FOR UPDATE USING (
    EXISTS (
      SELECT 1
      FROM public.child_profiles cp
      WHERE cp.id = child_learning_stats.child_id
        AND cp.guardian_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.child_profiles cp
      WHERE cp.id = child_learning_stats.child_id
        AND cp.guardian_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS child_genre_progress_own_household_select ON public.child_genre_progress;
DROP POLICY IF EXISTS child_genre_progress_own_household_insert ON public.child_genre_progress;
DROP POLICY IF EXISTS child_genre_progress_own_household_update ON public.child_genre_progress;

CREATE POLICY child_genre_progress_own_household_select ON public.child_genre_progress
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.child_profiles cp
      WHERE cp.id = child_genre_progress.child_id
        AND cp.guardian_id = auth.uid()
    )
  );

CREATE POLICY child_genre_progress_own_household_insert ON public.child_genre_progress
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.child_profiles cp
      WHERE cp.id = child_genre_progress.child_id
        AND cp.guardian_id = auth.uid()
    )
  );

CREATE POLICY child_genre_progress_own_household_update ON public.child_genre_progress
  FOR UPDATE USING (
    EXISTS (
      SELECT 1
      FROM public.child_profiles cp
      WHERE cp.id = child_genre_progress.child_id
        AND cp.guardian_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.child_profiles cp
      WHERE cp.id = child_genre_progress.child_id
        AND cp.guardian_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS child_subject_stats_own_household_select ON public.child_subject_stats;
DROP POLICY IF EXISTS child_subject_stats_own_household_insert ON public.child_subject_stats;
DROP POLICY IF EXISTS child_subject_stats_own_household_update ON public.child_subject_stats;

CREATE POLICY child_subject_stats_own_household_select ON public.child_subject_stats
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.child_profiles cp
      WHERE cp.id = child_subject_stats.child_id
        AND cp.guardian_id = auth.uid()
    )
  );

CREATE POLICY child_subject_stats_own_household_insert ON public.child_subject_stats
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.child_profiles cp
      WHERE cp.id = child_subject_stats.child_id
        AND cp.guardian_id = auth.uid()
    )
  );

CREATE POLICY child_subject_stats_own_household_update ON public.child_subject_stats
  FOR UPDATE USING (
    EXISTS (
      SELECT 1
      FROM public.child_profiles cp
      WHERE cp.id = child_subject_stats.child_id
        AND cp.guardian_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.child_profiles cp
      WHERE cp.id = child_subject_stats.child_id
        AND cp.guardian_id = auth.uid()
    )
  );
