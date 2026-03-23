import { redirect } from 'next/navigation';
import ParentClient from './ParentClient';
import PageShell from '@/components/layout/PageShell';
import { createServerSupabaseClient, getAuthenticatedUser } from '@/lib/auth/server';
import { ensureGuardianProfile, getParentGateState, getParentManagementSnapshot } from '@/lib/auth/data';

export default async function ParentPage() {
  const { user } = await getAuthenticatedUser();
  if (!user) {
    redirect('/');
  }

  const supabase = await createServerSupabaseClient();
  await ensureGuardianProfile(supabase, user);
  const initialState = await getParentGateState(supabase, user.id);
  const initialSnapshot = initialState.unlocked ? await getParentManagementSnapshot(supabase, user.id) : null;

  return (
    <PageShell maxWidthClass="max-w-6xl" mainClassName="flex flex-col items-center gap-8 pt-6 sm:pt-10">
      <ParentClient
        initialHasParentPin={initialState.hasParentPin}
        initialUnlocked={initialState.unlocked}
        initialSnapshot={initialSnapshot}
      />
    </PageShell>
  );
}
