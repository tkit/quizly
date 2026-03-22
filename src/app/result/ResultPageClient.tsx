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
      const accessToken = authSession.session?.access_token;
      if (!accessToken) {
        router.replace('/');
        return;
      }

      const response = await fetch(`/api/result/session?session_id=${encodeURIComponent(sessionId)}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const body = (await response.json().catch(() => null)) as {
        error?: string;
        session?: Session;
        history?: HistoryItem[];
      } | null;

      if (!response.ok || !body?.session) {
        setError('結果の読み込みに失敗しました。');
        setLoading(false);
        return;
      }

      setSession(body.session);
      setHistory(body.history ?? []);
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
