'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import ResultClient from './ResultClient';
import MessageCard from '@/components/feedback/MessageCard';
import PageShell from '@/components/layout/PageShell';

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

export default function ResultPageClient() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [session, setSession] = useState<Session | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sessionId = searchParams.get('session_id');

    const load = async () => {
      if (!sessionId) {
        setError('セッションIDが指定されていません。');
        setLoading(false);
        return;
      }

      const { data: authSession } = await supabase.auth.getSession();
      if (!authSession.session) {
        router.replace('/');
        return;
      }

      const { data: sessionData, error: sessionError } = await supabase
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
        .single();

      if (sessionError || !sessionData) {
        setError('結果の読み込みに失敗しました。');
        setLoading(false);
        return;
      }

      const { data: historyData } = await supabase
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
        .order('answered_at', { ascending: true });

      setSession(sessionData as Session);
      setHistory((historyData ?? []) as HistoryItem[]);
      setLoading(false);
    };

    void load();
  }, [router, searchParams]);

  if (loading) {
    return (
      <PageShell maxWidthClass="max-w-3xl" mainClassName="flex flex-1 items-center justify-center">
        <p className="text-lg font-black text-zinc-700">結果を読み込み中...</p>
      </PageShell>
    );
  }

  if (error || !session) {
    return (
      <PageShell maxWidthClass="max-w-3xl" mainClassName="flex flex-1 items-center justify-center">
        <MessageCard
          title={error ?? '結果の読み込みに失敗しました。'}
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
      <ResultClient session={session} history={history} />
    </PageShell>
  );
}
