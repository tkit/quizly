import { cookies } from 'next/headers';
import { supabase } from '@/lib/supabase';
import DashboardClient from './DashboardClient';
import MessageCard from '@/components/feedback/MessageCard';
import PageShell from '@/components/layout/PageShell';
import { ACTIVE_CHILD_COOKIE } from '@/lib/auth/constants';

export const revalidate = 0;

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const initialActiveChildId = cookieStore.get(ACTIVE_CHILD_COOKIE)?.value ?? null;

  const [{ data: genres, error: genresError }, { data: questionCounts, error: questionCountsError }] = await Promise.all([
    supabase
      .from('genres')
      .select('*')
      .order('parent_id', { ascending: true, nullsFirst: true })
      .order('id', { ascending: true }),
    supabase.rpc('get_active_question_counts'),
  ]);

  if (genresError || questionCountsError) {
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

  const questionCountByGenreId = (questionCounts ?? []).reduce((acc: Record<string, number>, questionCount: any) => {
    acc[questionCount.genre_id] = Number(questionCount.question_count ?? 0);
    return acc;
  }, {});

  const genresWithQuestionCount = (genres ?? []).map((genre: any) => ({
    ...genre,
    question_count: questionCountByGenreId[genre.id] ?? 0,
  }));

  return (
    <PageShell maxWidthClass="max-w-4xl">
      <DashboardClient genres={genresWithQuestionCount} initialActiveChildId={initialActiveChildId} />
    </PageShell>
  );
}
