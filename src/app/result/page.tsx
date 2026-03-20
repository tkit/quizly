import { supabase } from '@/lib/supabase';
import ResultClient from './ResultClient';

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
      <div className="flex min-h-screen items-center justify-center p-4 text-red-500">
        セッションIDが指定されていません。
      </div>
    );
  }

  // Fetch session
  const { data: session, error: sessionError } = await supabase
    .from('study_sessions')
    .select(`
      *,
      genres (
        name,
        icon,
        color_hint
      )
    `)
    .eq('id', sessionId)
    .single();

  if (sessionError || !session) {
    console.error('Error fetching session:', sessionError);
    return (
      <div className="flex min-h-screen items-center justify-center p-4 text-red-500">
        結果の読み込みに失敗しました。
      </div>
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
    <div className="flex min-h-screen flex-col items-center bg-zinc-50 dark:bg-zinc-950 px-4 py-8">
      <main className="w-full max-w-3xl flex flex-col gap-8">
        <ResultClient session={session} history={history || []} />
      </main>
    </div>
  );
}
