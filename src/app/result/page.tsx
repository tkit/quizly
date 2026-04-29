import { redirect } from 'next/navigation';
import PageShell from '@/components/layout/PageShell';
import ResultClient from './ResultClient';
import MessageCard from '@/components/feedback/MessageCard';
import { getD1ResultSessionSnapshot } from '@/lib/result/sessionResult';
import { getAuthenticatedUser } from '@/lib/auth/server';
import { getOptionalD1Database } from '@/lib/cloudflare/d1';

export default async function ResultPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string; point_capped?: string }>;
}) {
  const { user } = await getAuthenticatedUser();
  if (!user) {
    redirect('/');
  }

  const { session_id: sessionId, point_capped: pointCappedParam } = await searchParams;
  const pointCapped = pointCappedParam === '1';
  if (!sessionId) {
    return (
      <PageShell maxWidthClass="max-w-3xl" mainClassName="flex flex-1 items-center justify-center">
        <MessageCard
          title="セッションIDが指定されていません。"
          description="ダッシュボードから学習結果を開いてください。"
          actionLabel="ダッシュボードへ"
          actionHref="/dashboard"
          tone="error"
        />
      </PageShell>
    );
  }

  const d1 = await getOptionalD1Database();
  if (!d1) {
    throw new Error('D1 binding is required');
  }

  let snapshot;
  try {
    snapshot = await getD1ResultSessionSnapshot(d1, {
      guardianId: user.id,
      sessionId,
    });
  } catch (error) {
    console.error('[result] failed to load d1 session snapshot', error);
    return (
      <PageShell maxWidthClass="max-w-3xl" mainClassName="flex flex-1 items-center justify-center">
        <MessageCard
          title="結果の読み込みに失敗しました。"
          description="時間をおいて再度お試しください。"
          actionLabel="ダッシュボードへ"
          actionHref="/dashboard"
          tone="error"
        />
      </PageShell>
    );
  }

  return (
    <PageShell maxWidthClass="max-w-3xl">
      <ResultClient
        session={snapshot.session}
        history={snapshot.history}
        unlockedBadges={snapshot.unlockedBadges}
        pointCapped={pointCapped}
      />
    </PageShell>
  );
}
