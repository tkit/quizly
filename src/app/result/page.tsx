import { redirect } from 'next/navigation';
import PageShell from '@/components/layout/PageShell';
import ResultClient from './ResultClient';
import MessageCard from '@/components/feedback/MessageCard';
import { createServerSupabaseClient, getAuthenticatedUser } from '@/lib/auth/server';

type QuestionDetails = {
  question_text: string;
  options: string[];
  correct_index: number;
  explanation: string | null;
};

type HistoryItem = {
  is_correct: boolean;
  selected_index: number;
  questions: QuestionDetails | QuestionDetails[] | null;
};

type Session = {
  id: string;
  genre_id: string;
  total_questions: number;
  correct_count: number;
  earned_points: number;
  mode: string;
  genres: {
    name: string;
    icon_key: string;
    color_hint: string;
  } | null;
};

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
  const [{ data: sessionData, error: sessionError }, { data: historyData, error: historyError }] = await Promise.all([
    supabase
      .from('study_sessions')
      .select(
        `
        *,
        genres (
          name,
          icon_key,
          color_hint
        )
      `,
      )
      .eq('id', sessionId)
      .single(),
    supabase
      .from('study_history')
      .select(
        `
        is_correct,
        selected_index,
        questions (
          question_text,
          options,
          correct_index,
          explanation
        )
      `,
      )
      .eq('session_id', sessionId)
      .order('answered_at', { ascending: true }),
  ]);

  if (sessionError || !sessionData || historyError) {
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
      <ResultClient session={sessionData as Session} history={(historyData ?? []) as HistoryItem[]} />
    </PageShell>
  );
}
