import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import QuizClient from './QuizClient';
import MessageCard from '@/components/feedback/MessageCard';
import PageShell from '@/components/layout/PageShell';
import { ACTIVE_CHILD_COOKIE } from '@/lib/auth/constants';
import { getAuthenticatedUser, createServerSupabaseClient } from '@/lib/auth/server';
import { getQuizQuestionSet, type QuizQuestionRow } from '@/lib/quiz/questionSet';

type GenreRow = {
  id: string;
  name: string;
  icon_key: string;
  color_hint: string | null;
  parent_id: string | null;
};

export const revalidate = 0;

export default async function QuizPage({
  searchParams,
}: {
  searchParams: Promise<{ genre?: string; count?: string }>;
}) {
  const { user } = await getAuthenticatedUser();
  const cookieStore = await cookies();
  const activeChildId = cookieStore.get(ACTIVE_CHILD_COOKIE)?.value ?? null;

  if (!user || !activeChildId) {
    redirect('/');
  }

  const supabase = await createServerSupabaseClient();
  const resolvedParams = await searchParams;
  const genreId = resolvedParams.genre;
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

  const resolvedGenre = genre as GenreRow | null;

  if (genreError || !resolvedGenre) {
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

  if (resolvedGenre.parent_id == null) {
    return (
      <PageShell maxWidthClass="max-w-3xl" mainClassName="flex flex-1 items-center justify-center">
        <MessageCard
          title="サブカテゴリを選択してから開始してください。"
          description={`「${resolvedGenre.name}」は教科（親カテゴリ）のため、クイズは開始できません。`}
          actionLabel="ダッシュボードへ戻る"
          actionHref="/dashboard"
          tone="warning"
        />
      </PageShell>
    );
  }

  let questions: QuizQuestionRow[] = [];
  try {
    questions = await getQuizQuestionSet(supabase, {
      childId: activeChildId,
      genreId,
      requestedCount: parsedCount,
    });
  } catch {
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

  return (
    <PageShell maxWidthClass="max-w-3xl" mainClassName="flex h-full flex-1 flex-col">
      <QuizClient
        childId={activeChildId}
        genre={resolvedGenre}
        questions={questions}
      />
    </PageShell>
  );
}
