import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import QuizClient from './QuizClient';
import MessageCard from '@/components/feedback/MessageCard';
import PageShell from '@/components/layout/PageShell';
import { ACTIVE_CHILD_COOKIE } from '@/lib/auth/constants';
import { getAuthenticatedUser, createServerSupabaseClient } from '@/lib/auth/server';

type GenreRow = {
  id: string;
  name: string;
  icon_key: string;
  color_hint: string | null;
  parent_id: string | null;
};

type QuestionRow = {
  id: string;
  genre_id: string;
  question_text: string;
  options: string[];
  correct_index: number;
  explanation: string | null;
  image_url: string | null;
};

function buildStableQuestionOrderKey(childId: string, genreId: string, mode: string, questionId: string) {
  const source = `${childId}:${genreId}:${mode}:${questionId}`;
  let hash = 0;

  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) >>> 0;
  }

  return hash;
}

export const revalidate = 0;

export default async function QuizPage({
  searchParams,
}: {
  searchParams: Promise<{ genre?: string; mode?: string; count?: string }>;
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

  let allQuestions: QuestionRow[] | null = null;
  let questionsError: Error | null = null;

  if (mode === 'review') {
    const { data: history, error: historyError } = await supabase
      .from('study_history')
      .select('question_id')
      .eq('child_id', activeChildId)
      .eq('is_correct', false);

    if (historyError) {
      questionsError = historyError;
    } else {
      const wrongQuestionIds = Array.from(new Set((history ?? []).map((item: { question_id: string }) => item.question_id)));

      if (wrongQuestionIds.length === 0) {
        allQuestions = [];
      } else {
        const { data, error } = await supabase
          .from('questions')
          .select('*')
          .eq('genre_id', genreId)
          .eq('is_active', true)
          .in('id', wrongQuestionIds);

        allQuestions = (data ?? []) as QuestionRow[];
        questionsError = error;
      }
    }
  } else {
    const { data, error } = await supabase
      .from('questions')
      .select('*')
      .eq('genre_id', genreId)
      .eq('is_active', true);

    allQuestions = (data ?? []) as QuestionRow[];
    questionsError = error;
  }

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

  const questions = [...allQuestions]
    .sort(
      (left, right) =>
        buildStableQuestionOrderKey(activeChildId, genreId, mode, left.id) -
        buildStableQuestionOrderKey(activeChildId, genreId, mode, right.id),
    )
    .slice(0, count);

  return (
    <PageShell maxWidthClass="max-w-3xl" mainClassName="flex h-full flex-1 flex-col">
      <QuizClient
        childId={activeChildId}
        genre={resolvedGenre}
        mode={mode}
        questions={questions}
      />
    </PageShell>
  );
}
