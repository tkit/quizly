import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import DashboardClient from './DashboardClient';
import MessageCard from '@/components/feedback/MessageCard';
import PageShell from '@/components/layout/PageShell';
import { ACTIVE_CHILD_COOKIE } from '@/lib/auth/constants';
import {
  clearD1ParentReauthSession,
  getD1BadgeSummary,
  getD1DashboardGenreCatalog,
  getD1DashboardSnapshot,
} from '@/lib/auth/d1';
import { clearParentReauthSession } from '@/lib/auth/parentReauth';
import { getDashboardGenreCatalog, getDashboardSnapshot } from '@/lib/auth/data';
import { getBadgeSummary, type BadgeSummary } from '@/lib/badges/overview';
import { getAuthenticatedUser } from '@/lib/auth/server';
import { createServerSupabaseClient } from '@/lib/auth/server';
import { getOptionalD1Database } from '@/lib/cloudflare/d1';

export const revalidate = 0;

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const initialActiveChildId = cookieStore.get(ACTIVE_CHILD_COOKIE)?.value ?? null;
  const { user } = await getAuthenticatedUser();

  if (!user || !initialActiveChildId) {
    redirect('/');
  }

  const d1 = await getOptionalD1Database();
  if (d1) {
    await clearD1ParentReauthSession(d1, user.id).catch((error) => {
      console.warn('[dashboard] failed to clear d1 parent reauth session', error);
    });

    const snapshot = await getD1DashboardSnapshot(d1, {
      guardianId: user.id,
      activeChildId: initialActiveChildId,
    });

    if (!snapshot) {
      redirect('/');
    }

    const [genreCatalogResult, badgeSummaryResult] = await Promise.allSettled([
      getD1DashboardGenreCatalog(d1),
      getD1BadgeSummary(d1, initialActiveChildId),
    ]);

    if (genreCatalogResult.status === 'rejected') {
      console.error('[dashboard] failed to load d1 genre catalog', genreCatalogResult.reason);
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

    const badgeSummary: BadgeSummary | null =
      badgeSummaryResult.status === 'fulfilled' ? badgeSummaryResult.value : null;

    return (
      <PageShell maxWidthClass="max-w-4xl">
        <DashboardClient
          activeChild={snapshot.activeChild}
          canSwitchChild={snapshot.canSwitchChild}
          genres={genreCatalogResult.value}
          studyStatusByGenreId={snapshot.studyStatusByGenreId}
          badgeSummary={badgeSummary}
        />
      </PageShell>
    );
  }

  const supabase = await createServerSupabaseClient();
  await clearParentReauthSession(supabase, user.id);
  const snapshot = await getDashboardSnapshot(supabase, initialActiveChildId);

  if (!snapshot) {
    redirect('/');
  }

  const [genreCatalogResult, badgeSummaryResult] = await Promise.allSettled([
    getDashboardGenreCatalog(supabase),
    getBadgeSummary(supabase, { childId: initialActiveChildId }),
  ]);

  if (genreCatalogResult.status === 'rejected') {
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

  const genresWithQuestionCount = genreCatalogResult.value;
  const badgeSummary: BadgeSummary | null =
    badgeSummaryResult.status === 'fulfilled' ? badgeSummaryResult.value : null;

  return (
    <PageShell maxWidthClass="max-w-4xl">
      <DashboardClient
        activeChild={snapshot.activeChild}
        canSwitchChild={snapshot.canSwitchChild}
        genres={genresWithQuestionCount}
        studyStatusByGenreId={snapshot.studyStatusByGenreId}
        badgeSummary={badgeSummary}
      />
    </PageShell>
  );
}
