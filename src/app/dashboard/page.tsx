import { supabase } from '@/lib/supabase';
import DashboardClient from './DashboardClient';

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

  if (genresError) {
    console.error('Error fetching genres:', genresError);
    return (
      <div className="flex min-h-screen-safe items-center justify-center p-4">
        <p className="text-red-500">ジャンルの読み込みに失敗しました。</p>
      </div>
    );
  }

  if (questionsError) {
    console.error('Error fetching questions:', questionsError);
    return (
      <div className="flex min-h-screen-safe items-center justify-center p-4">
        <p className="text-red-500">問題数の読み込みに失敗しました。</p>
      </div>
    );
  }

  const questionCountByGenreId = (questions ?? []).reduce<Record<string, number>>((acc, question) => {
    acc[question.genre_id] = (acc[question.genre_id] ?? 0) + 1;
    return acc;
  }, {});

  const genresWithQuestionCount = (genres ?? []).map((genre) => ({
    ...genre,
    question_count: questionCountByGenreId[genre.id] ?? 0,
  }));

  return (
    <div className="flex min-h-screen-safe flex-col items-center bg-zinc-50 px-4 py-5 sm:px-6 sm:py-8 lg:px-8 dark:bg-zinc-950">
      <main className="w-full max-w-4xl flex flex-col gap-8">
        <DashboardClient genres={genresWithQuestionCount} />
      </main>
    </div>
  );
}
