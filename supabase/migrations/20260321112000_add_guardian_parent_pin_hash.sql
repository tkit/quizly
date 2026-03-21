ALTER TABLE public.guardian_accounts
  ADD COLUMN IF NOT EXISTS parent_pin_hash text;
