import { redirect } from 'next/navigation';
import ParentClient from './ParentClient';
import PageShell from '@/components/layout/PageShell';
import { createServerSupabaseClient, getAuthenticatedUser } from '@/lib/auth/server';
import { ensureGuardianProfile, getParentGateState, getParentManagementSnapshot } from '@/lib/auth/data';
import { ensureD1GuardianProfile, getD1ParentGateState, getD1ParentManagementSnapshot } from '@/lib/auth/d1';
import { getOptionalD1Database } from '@/lib/cloudflare/d1';

export default async function ParentPage() {
  const { user } = await getAuthenticatedUser();
  if (!user) {
    redirect('/');
  }

  const d1 = await getOptionalD1Database();
  const initialState = d1
    ? await (async () => {
        await ensureD1GuardianProfile(d1, user);
        return getD1ParentGateState(d1, user.id);
      })()
    : await (async () => {
        const supabase = await createServerSupabaseClient();
        await ensureGuardianProfile(supabase, user);
        return getParentGateState(supabase, user.id);
      })();
  const initialSnapshot = initialState.unlocked
    ? d1
      ? await getD1ParentManagementSnapshot(d1, user.id)
      : await getParentManagementSnapshot(await createServerSupabaseClient(), user.id)
    : null;

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
