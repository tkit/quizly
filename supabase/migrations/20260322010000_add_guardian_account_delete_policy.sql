CREATE POLICY guardian_accounts_delete_own ON public.guardian_accounts
  FOR DELETE USING (id = auth.uid());
