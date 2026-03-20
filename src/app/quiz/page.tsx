import { supabase } from '@/lib/supabase';
import QuizClient from './QuizClient';

export const revalidate = 0;

export default async function QuizPage({
  searchParams,
}: {
  searchParams: Promise<{ genre?: string; mode?: string; count?: string }>;
}) {
  const resolvedParams = await searchParams;
  const genreId = resolvedParams.genre;
  const mode = resolvedParams.mode || 'normal';
  const countStr = resolvedParams.count;
  const parsedCount = countStr ? parseInt(countStr, 10) : null;

  if (!genreId) {
    return (
      <div className="flex min-h-screen-safe items-center justify-center p-4 text-red-500">
        ジャンルが指定されていません。
      </div>
    );
  }

  // Fetch genre
  const { data: genre, error: genreError } = await supabase
    .from('genres')
    .select('*')
    .eq('id', genreId)
    .single();

  if (genreError || !genre) {
    return (
      <div className="flex min-h-screen-safe items-center justify-center p-4 text-red-500">
        ジャンルの読み込みに失敗しました。
      </div>
    );
  }

  if (genre.parent_id == null) {
    return (
      <div className="flex min-h-screen-safe flex-col items-center justify-center gap-6 bg-zinc-50 p-6 text-center dark:bg-zinc-950">
        <div className="w-full max-w-xl rounded-[2rem] border-4 border-zinc-400 bg-white p-6 shadow-brutal sm:p-8">
          <p className="mb-3 text-[clamp(1.25rem,5vw,1.5rem)] font-black text-zinc-800">サブカテゴリを選択してから開始してください。</p>
          <p className="text-base font-bold text-zinc-600 sm:text-lg">
            「{genre.name}」は教科（親カテゴリ）のため、クイズは開始できません。
          </p>
        </div>
        <a
          href="/dashboard"
          className="inline-flex min-h-11 items-center justify-center rounded-full border-4 border-zinc-400 bg-teal-400 px-8 py-2 font-black text-zinc-900 shadow-brutal hover:bg-teal-500"
        >
          ダッシュボードに戻る
        </a>
      </div>
    );
  }

  // Fetch questions based on genre and active status
  // Note: For 'review' mode we'd ideally fetch only incorrectly answered questions for the specific user.
  // Since we rely on the client to know the user in this simple setup (localStorage), 
  // doing server-side fetching for 'review' mode requires passing userId or doing it entirely client-side.
  // To keep it simple but aligned with the App Router model: we'll fetch all active questions for the genre
  // and handle the filtering or taking random N questions in the QuizClient, or we can fetch a pool here.
  // Given we don't have user context on the server (no cookies used right now, only localStorage),
  // we must fetch a larger pool and select down in the client, or we just pass them all to the client.

  const { data: allQuestions, error: questionsError } = await supabase
    .from('questions')
    .select('*')
    .eq('genre_id', genreId)
    .eq('is_active', true);

  if (questionsError || !allQuestions) {
    return (
      <div className="flex min-h-screen-safe items-center justify-center p-4 text-red-500">
        問題の読み込みに失敗しました。
      </div>
    );
  }

  const count =
    parsedCount && parsedCount > 0
      ? Math.min(parsedCount, allQuestions.length)
      : allQuestions.length;

  return (
    <div className="flex min-h-screen-safe flex-col items-center bg-zinc-50 px-4 py-5 sm:px-6 sm:py-8 lg:px-8 dark:bg-zinc-950">
      <main className="w-full max-w-3xl flex flex-col h-full flex-1">
        <QuizClient 
          genre={genre} 
          allQuestions={allQuestions} 
          mode={mode} 
          count={count} 
        />
      </main>
    </div>
  );
}
