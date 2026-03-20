import { supabase } from '@/lib/supabase';
import QuizClient from './QuizClient';
import MessageCard from '@/components/feedback/MessageCard';
import PageShell from '@/components/layout/PageShell';

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
      <PageShell maxWidthClass="max-w-3xl" mainClassName="flex flex-1 items-center justify-center">
        <MessageCard
          title="ジャンルが指定されていません。"
          description="ダッシュボードからカテゴリを選んで開始してください。"
          actionLabel="ダッシュボードへ"
          actionHref="/dashboard"
          tone="error"
        />
      </PageShell>
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
      <PageShell maxWidthClass="max-w-3xl" mainClassName="flex flex-1 items-center justify-center">
        <MessageCard
          title="ジャンルの読み込みに失敗しました。"
          description="時間をおいて再度お試しください。"
          actionLabel="ダッシュボードへ"
          actionHref="/dashboard"
          tone="error"
        />
      </PageShell>
    );
  }

  if (genre.parent_id == null) {
    return (
      <PageShell maxWidthClass="max-w-3xl" mainClassName="flex flex-1 items-center justify-center">
        <MessageCard
          title="サブカテゴリを選択してから開始してください。"
          description={`「${genre.name}」は教科（親カテゴリ）のため、クイズは開始できません。`}
          actionLabel="ダッシュボードへ戻る"
          actionHref="/dashboard"
          tone="warning"
        />
      </PageShell>
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
      <PageShell maxWidthClass="max-w-3xl" mainClassName="flex flex-1 items-center justify-center">
        <MessageCard
          title="問題の読み込みに失敗しました。"
          description="通信状況をご確認のうえ、再度お試しください。"
          actionLabel="ダッシュボードへ"
          actionHref="/dashboard"
          tone="error"
        />
      </PageShell>
    );
  }

  const count =
    parsedCount && parsedCount > 0
      ? Math.min(parsedCount, allQuestions.length)
      : allQuestions.length;

  return (
    <PageShell maxWidthClass="max-w-3xl" mainClassName="flex h-full flex-1 flex-col">
      <QuizClient 
        genre={genre} 
        allQuestions={allQuestions} 
        mode={mode} 
        count={count} 
      />
    </PageShell>
  );
}
