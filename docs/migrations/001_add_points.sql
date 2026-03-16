-- =============================================
-- Point System Migration (Phase 1)
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. Add total_points column to users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS total_points integer DEFAULT 0;

-- 2. Add earned_points column to study_sessions table
ALTER TABLE public.study_sessions
  ADD COLUMN IF NOT EXISTS earned_points integer DEFAULT 0;

-- 3. Create point_transactions table
CREATE TABLE IF NOT EXISTS public.point_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id),
  session_id uuid REFERENCES public.study_sessions(id),
  points integer NOT NULL,
  reason text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;

-- Drop policy if exists to avoid error on re-run
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'point_transactions'
    AND policyname = 'Allow all access to point_transactions'
  ) THEN
    CREATE POLICY "Allow all access to point_transactions"
      ON public.point_transactions FOR ALL USING (true);
  END IF;
END
$$;
