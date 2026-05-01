import { redirect } from 'next/navigation';
import ParentClient from './ParentClient';
import PageShell from '@/components/layout/PageShell';
import { getAuthenticatedUser } from '@/lib/auth/server';
import { ensureD1GuardianProfile, getD1ParentGateState, getD1ParentManagementSnapshot } from '@/lib/auth/d1';
import { getOptionalD1Database } from '@/lib/cloudflare/d1';

export default async function ParentPage() {
  const { user } = await getAuthenticatedUser();
  if (!user) {
    redirect('/');
  }

  const d1 = await getOptionalD1Database();
  if (!d1) {
    throw new Error('D1 binding is required');
  }

  await ensureD1GuardianProfile(d1, user);
  const initialState = await getD1ParentGateState(d1, user.id);
  const initialSnapshot = initialState.unlocked ? await getD1ParentManagementSnapshot(d1, user.id) : null;

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
