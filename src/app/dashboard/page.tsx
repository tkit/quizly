import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import DashboardClient from './DashboardClient';
import MessageCard from '@/components/feedback/MessageCard';
import PageShell from '@/components/layout/PageShell';
import { ACTIVE_CHILD_COOKIE } from '@/lib/auth/constants';
import { clearParentReauthSession } from '@/lib/auth/parentReauth';
import { getDashboardGenreCatalog, getDashboardSnapshot } from '@/lib/auth/data';
import { getAuthenticatedUser } from '@/lib/auth/server';
import { createServerSupabaseClient } from '@/lib/auth/server';

export const revalidate = 0;

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const initialActiveChildId = cookieStore.get(ACTIVE_CHILD_COOKIE)?.value ?? null;
  const { user } = await getAuthenticatedUser();

  if (!user || !initialActiveChildId) {
    redirect('/');
  }

  const supabase = await createServerSupabaseClient();
  await clearParentReauthSession(supabase, user.id);
  const snapshot = await getDashboardSnapshot(supabase, initialActiveChildId);

  if (!snapshot) {
    redirect('/');
  }

  let genresWithQuestionCount;
  try {
    genresWithQuestionCount = await getDashboardGenreCatalog(supabase);
  } catch {
    return (
      <PageShell maxWidthClass="max-w-4xl" mainClassName="flex flex-1 items-center justify-center">
        <MessageCard
          title="ジャンル情報の読み込みに失敗しました。"
          description="時間をおいて再度お試しください。"
          actionLabel="トップへ戻る"
          actionHref="/"
          tone="error"
        />
      </PageShell>
    );
  }

  return (
    <PageShell maxWidthClass="max-w-4xl">
      <DashboardClient
        activeChild={snapshot.activeChild}
        canSwitchChild={snapshot.canSwitchChild}
        genres={genresWithQuestionCount}
        studyStatusByGenreId={snapshot.studyStatusByGenreId}
      />
    </PageShell>
  );
}
