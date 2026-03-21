import { supabase } from '@/lib/supabase';
import DashboardClient from './DashboardClient';
import MessageCard from '@/components/feedback/MessageCard';
import PageShell from '@/components/layout/PageShell';

export const revalidate = 0;

export default async function DashboardPage() {
  const [{ data: genres, error: genresError }, { data: questions, error: questionsError }] = await Promise.all([
    supabase
      .from('genres')
      .select('*')
      .order('parent_id', { ascending: true, nullsFirst: true })
      .order('id', { ascending: true }),
    supabase
      .from('questions')
      .select('genre_id')
      .eq('is_active', true),
  ]);

  if (genresError || questionsError) {
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

  const questionCountByGenreId = (questions ?? []).reduce((acc: Record<string, number>, question: any) => {
    acc[question.genre_id] = (acc[question.genre_id] ?? 0) + 1;
    return acc;
  }, {});

  const genresWithQuestionCount = (genres ?? []).map((genre: any) => ({
    ...genre,
    question_count: questionCountByGenreId[genre.id] ?? 0,
  }));

  return (
    <PageShell maxWidthClass="max-w-4xl">
      <DashboardClient genres={genresWithQuestionCount} />
    </PageShell>
  );
}
