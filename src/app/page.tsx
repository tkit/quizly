import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import HomeClient from './HomeClient';
import PageShell from '@/components/layout/PageShell';
import { ACTIVE_CHILD_COOKIE } from '@/lib/auth/constants';
import { ensureD1GuardianProfile, getD1ChildProfile, listD1ChildProfiles } from '@/lib/auth/d1';
import { ensureGuardianProfile, listChildProfiles } from '@/lib/auth/data';
import { createServerSupabaseClient, getAuthenticatedUser, isLegacySupabaseConfigured } from '@/lib/auth/server';
import { getOptionalD1Database } from '@/lib/cloudflare/d1';

export default async function Home() {
  const cookieStore = await cookies();
  const activeChildId = cookieStore.get(ACTIVE_CHILD_COOKIE)?.value;
  const { user } = await getAuthenticatedUser();
  const d1 = user ? await getOptionalD1Database() : null;
  const supabase = user && !d1 && isLegacySupabaseConfigured() ? await createServerSupabaseClient() : null;

  if (user && d1) {
    await ensureD1GuardianProfile(d1, user).catch((error) => {
      console.error('[home] failed to ensure d1 guardian profile', error);
    });

    if (activeChildId) {
      const activeChild = await getD1ChildProfile(d1, user.id, activeChildId).catch((error) => {
        console.error('[home] failed to read d1 active child', error);
        return null;
      });

      if (activeChild) {
        redirect('/dashboard');
      }
    }
  }

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

  const initialChildren = user && d1
    ? await listD1ChildProfiles(d1, user.id).catch((error) => {
        console.error('[home] failed to list d1 children', error);
        return [];
      })
    : user && supabase
      ? await listChildProfiles(supabase).catch(() => [])
      : [];

  return (
    <PageShell maxWidthClass="max-w-4xl" mainClassName="flex flex-col items-center gap-8 pt-6 sm:pt-10">
      <HomeClient initialChildren={initialChildren} isParentAuthenticated={Boolean(user)} />
    </PageShell>
  );
}
