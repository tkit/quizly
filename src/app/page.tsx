import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import HomeClient from './HomeClient';
import PageShell from '@/components/layout/PageShell';
import { ACTIVE_CHILD_COOKIE } from '@/lib/auth/constants';
import { ensureGuardianProfile, listChildProfiles } from '@/lib/auth/data';
import { createServerSupabaseClient, getAuthenticatedUser, isLegacySupabaseConfigured } from '@/lib/auth/server';

export default async function Home() {
  const cookieStore = await cookies();
  const activeChildId = cookieStore.get(ACTIVE_CHILD_COOKIE)?.value;
  const { user } = await getAuthenticatedUser();
  const supabase = user && isLegacySupabaseConfigured() ? await createServerSupabaseClient() : null;

  if (user && supabase) {
    await ensureGuardianProfile(supabase, user).catch(() => null);

    if (activeChildId) {
      const { data: activeChild } = await supabase
        .from('child_profiles')
        .select('id')
        .eq('id', activeChildId)
        .maybeSingle();

      if (activeChild) {
        redirect('/dashboard');
      }
    }
  }

  const initialChildren = user && supabase ? await listChildProfiles(supabase).catch(() => []) : [];

  return (
    <PageShell maxWidthClass="max-w-4xl" mainClassName="flex flex-col items-center gap-8 pt-6 sm:pt-10">
      <HomeClient initialChildren={initialChildren} isParentAuthenticated={Boolean(user)} />
    </PageShell>
  );
}
