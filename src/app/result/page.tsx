import { supabase } from '@/lib/supabase';
import ResultClient from './ResultClient';
import MessageCard from '@/components/feedback/MessageCard';
import PageShell from '@/components/layout/PageShell';

export const revalidate = 0;

export default async function ResultPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const resolvedParams = await searchParams;
  const sessionId = resolvedParams.session_id;

  if (!sessionId) {
    return (
      <PageShell maxWidthClass="max-w-3xl" mainClassName="flex flex-1 items-center justify-center">
        <MessageCard
          title="セッションIDが指定されていません。"
          description="クイズ終了後の画面から結果を表示してください。"
          actionLabel="ダッシュボードへ"
          actionHref="/dashboard"
          tone="error"
        />
      </PageShell>
    );
  }

  // Fetch session
  const { data: session, error: sessionError } = await supabase
    .from('study_sessions')
    .select(`
      *,
      genres (
        name,
        icon_key,
        color_hint
      )
    `)
    .eq('id', sessionId)
    .single();

  if (sessionError || !session) {
    console.error('Error fetching session:', sessionError);
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

  // Fetch history with questions
  const { data: history, error: historyError } = await supabase
    .from('study_history')
    .select(`
      is_correct,
      selected_index,
      questions (
        question_text,
        options,
        correct_index,
        explanation
      )
    `)
    .eq('session_id', sessionId)
    .order('answered_at', { ascending: true });

  if (historyError) {
    console.error('Error fetching history:', historyError);
  }

  return (
    <PageShell maxWidthClass="max-w-3xl">
      <ResultClient session={session} history={history || []} />
    </PageShell>
  );
}
