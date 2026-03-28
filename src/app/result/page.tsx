import { redirect } from 'next/navigation';
import PageShell from '@/components/layout/PageShell';
import ResultClient from './ResultClient';
import MessageCard from '@/components/feedback/MessageCard';
import { getResultSessionSnapshot } from '@/lib/result/sessionResult';
import { createServerSupabaseClient, getAuthenticatedUser } from '@/lib/auth/server';

export default async function ResultPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { user } = await getAuthenticatedUser();
  if (!user) {
    redirect('/');
  }

  const { session_id: sessionId } = await searchParams;
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

  const supabase = await createServerSupabaseClient();
  let snapshot;
  try {
    snapshot = await getResultSessionSnapshot(supabase, {
      guardianId: user.id,
      sessionId,
    });
  } catch {
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
      <ResultClient session={snapshot.session} history={snapshot.history} unlockedBadges={snapshot.unlockedBadges} />
    </PageShell>
  );
}
