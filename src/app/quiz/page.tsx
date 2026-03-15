import { Suspense } from 'react';
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
  const countStr = resolvedParams.count || '5';
  const parsedCount = parseInt(countStr, 10);
  const count = isNaN(parsedCount) ? 5 : parsedCount;

  if (!genreId) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 text-red-500">
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
      <div className="flex min-h-screen items-center justify-center p-4 text-red-500">
        ジャンルの読み込みに失敗しました。
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
      <div className="flex min-h-screen items-center justify-center p-4 text-red-500">
        問題の読み込みに失敗しました。
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-50 dark:bg-zinc-950 px-4 py-8 sm:p-8">
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
