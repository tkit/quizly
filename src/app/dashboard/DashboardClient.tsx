'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, LogOut, Shield, UserRound } from 'lucide-react';
import { getBrowserSupabaseClient } from '@/lib/auth/browser';
import { GenreIcon } from '@/components/GenreIcon';
import { resolveSubjectTone } from '@/lib/ui/subjectTone';

interface Genre {
  id: string;
  name: string;
  icon_key: string;
  description: string | null;
  color_hint: string | null;
  parent_id: string | null;
  question_count: number;
}

type ActiveChild = {
  id: string;
  display_name: string;
  total_points: number;
};

type SessionRow = {
  genre_id: string | null;
  correct_count: number;
  total_questions: number;
};

export default function DashboardClient({ genres }: { genres: Genre[] }) {
  const router = useRouter();
  const supabase = getBrowserSupabaseClient();

  const [activeChild, setActiveChild] = useState<ActiveChild | null>(null);
  const [studyStatusByGenreId, setStudyStatusByGenreId] = useState<Record<string, 'unattempted' | 'studied_not_perfect' | 'perfect_cleared'>>({});
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [canSwitchChild, setCanSwitchChild] = useState(false);
  const [loading, setLoading] = useState(true);

  const parentGenres = useMemo(
    () => genres.filter((genre) => genre.parent_id == null),
    [genres],
  );

  const childGenres = useMemo(
    () => genres.filter((genre) => genre.parent_id === selectedParentId),
    [genres, selectedParentId],
  );

  const selectedParent = useMemo(
    () => parentGenres.find((genre) => genre.id === selectedParentId) ?? null,
    [parentGenres, selectedParentId],
  );

  const loadDashboard = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      router.replace('/');
      return;
    }

    const currentChildResponse = await fetch('/api/session/child/current', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const currentChildBody = (await currentChildResponse.json().catch(() => null)) as { child?: ActiveChild | null } | null;
    const child = currentChildBody?.child ?? null;

    if (!child) {
      router.replace('/');
      return;
    }

    setActiveChild(child);

    const { count: childCount } = await supabase
      .from('child_profiles')
      .select('id', { count: 'exact', head: true });
    setCanSwitchChild((childCount ?? 0) > 1);

    const { data: sessionsDataRaw } = await supabase
      .from('study_sessions')
      .select('genre_id, correct_count, total_questions')
      .eq('child_id', child.id);
    const sessionsData = (sessionsDataRaw ?? []) as SessionRow[];

    const statusMap: Record<string, 'unattempted' | 'studied_not_perfect' | 'perfect_cleared'> = {};
    for (const session of sessionsData) {
      if (!session.genre_id) continue;
      const isPerfect = session.total_questions > 0 && session.correct_count === session.total_questions;
      const current = statusMap[session.genre_id] ?? 'unattempted';
      if (isPerfect) {
        statusMap[session.genre_id] = 'perfect_cleared';
      } else if (current !== 'perfect_cleared') {
        statusMap[session.genre_id] = 'studied_not_perfect';
      }
    }

    setStudyStatusByGenreId(statusMap);
    setLoading(false);
  };

  useEffect(() => {
    void loadDashboard();
  }, []);

  const handleSwitchChild = async () => {
    await fetch('/api/session/child/logout', { method: 'POST' });
    router.push('/');
  };

  const handleParentLogout = async () => {
    await fetch('/api/session/child/logout', { method: 'POST' });
    await supabase.auth.signOut();
    router.push('/');
  };

  if (loading || !activeChild) {
    return <div className="p-8 text-center text-lg font-bold text-zinc-600">読み込み中...</div>;
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-1 sm:gap-8 sm:p-2">
      <header className="flex w-full flex-col gap-4 rounded-[2rem] border-4 border-zinc-400 bg-white p-4 shadow-brutal sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-4 border-zinc-400 bg-teal-300 text-zinc-900 shadow-brutal-sm sm:h-14 sm:w-14">
            <UserRound className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-[clamp(1.25rem,5.5vw,1.9rem)] font-black tracking-wide text-zinc-800">
              {activeChild.display_name} さん
            </h1>
            <p className="mt-1 text-sm font-bold text-teal-600 sm:text-base">保有ポイント: {activeChild.total_points.toLocaleString()} pt</p>
          </div>
        </div>
        <div className="flex gap-2 self-end sm:self-auto">
          <button
            onClick={() => router.push('/parent')}
            className="min-h-11 rounded-xl border-2 border-zinc-300 bg-slate-100 px-3 py-2 text-sm font-black text-zinc-700 hover:bg-slate-200"
          >
            <span className="inline-flex items-center gap-1">
              <Shield className="h-4 w-4" />
              保護者管理
            </span>
          </button>
          {canSwitchChild && (
            <button
              onClick={handleSwitchChild}
              className="min-h-11 rounded-xl border-2 border-zinc-300 bg-zinc-100 px-3 py-2 text-sm font-black text-zinc-700 hover:bg-zinc-200"
            >
              子を切り替える
            </button>
          )}
          <button
            onClick={handleParentLogout}
            className="group flex min-h-11 min-w-11 items-center justify-center rounded-2xl border-4 border-zinc-400 bg-amber-100 p-2.5 text-amber-700 shadow-brutal transition-colors hover:bg-amber-200"
            title="保護者ログアウト"
          >
            <LogOut className="h-6 w-6" />
          </button>
        </div>
      </header>

      <section className="flex flex-col gap-6 w-full">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display inline-block w-fit -rotate-1 rounded-full border-4 border-zinc-400 bg-white px-4 py-2 text-xl font-black text-zinc-800 shadow-brutal sm:px-6 sm:text-2xl">
            学習を開始する
          </h2>
          {selectedParent && (
            <button
              onClick={() => setSelectedParentId(null)}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border-4 border-zinc-400 bg-white px-4 py-2 text-sm font-black text-zinc-700 shadow-brutal-sm hover:bg-zinc-50 sm:text-base"
            >
              <ChevronLeft className="h-4 w-4" />
              教科選択に戻る
            </button>
          )}
        </div>

        {selectedParent ? (
          <div className="grid grid-cols-1 gap-5 w-full">
            {childGenres.map((genre) => {
              const tone = resolveSubjectTone(selectedParent?.id ?? genre.parent_id, genre.color_hint);
              const studyStatus = studyStatusByGenreId[genre.id] ?? 'unattempted';
              const statusLabel =
                studyStatus === 'perfect_cleared'
                  ? '全問正解達成'
                  : studyStatus === 'studied_not_perfect'
                    ? '受講済み'
                    : '未受講';

              return (
                <button
                  key={genre.id}
                  onClick={() => router.push(`/quiz?genre=${genre.id}`)}
                  className={`group relative flex w-full items-start gap-3 overflow-hidden rounded-[2rem] border-4 border-zinc-400 bg-white p-4 text-left text-zinc-900 shadow-brutal transition-all hover:-translate-y-1 hover:bg-slate-50 hover:shadow-brutal-lg ${tone.focusRingClass}`}
                >
                  <div className={`absolute left-0 top-0 h-full w-4 ${tone.stripClass}`} />
                  <div className={`z-10 flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.2rem] border-4 border-zinc-400 text-4xl shadow-brutal-sm ${tone.iconBgClass}`}>
                    <GenreIcon iconKey={genre.icon_key} className="h-8 w-8" strokeWidth={2.4} />
                  </div>
                  <div className="z-10 flex min-w-0 flex-1 flex-col gap-2 sm:gap-3">
                    <h3 className="font-display text-xl font-black leading-tight tracking-wide text-zinc-900 sm:text-[1.5rem]">{genre.name}</h3>
                    <p className="text-sm font-bold leading-relaxed text-zinc-700/85 sm:text-base">{genre.description}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 sm:gap-3">
                      <p className={`inline-flex items-center rounded-full border-2 px-3 py-1 text-xs font-black sm:text-base ${tone.badgeClass}`}>
                        全{genre.question_count}問
                      </p>
                      <span className="inline-flex items-center rounded-full border-2 border-zinc-300 bg-white/90 px-3 py-1 text-xs font-black text-zinc-700 sm:text-sm">
                        {statusLabel}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {parentGenres.map((genre) => {
              const tone = resolveSubjectTone(genre.id, genre.color_hint);
              return (
                <button
                  key={genre.id}
                  onClick={() => setSelectedParentId(genre.id)}
                  className="group flex items-center gap-4 rounded-3xl border-4 border-zinc-400 bg-white p-4 text-left shadow-brutal transition-all hover:-translate-y-1 hover:shadow-brutal-lg"
                >
                  <div className={`flex h-14 w-14 items-center justify-center rounded-2xl border-4 border-zinc-400 ${tone.iconBgClass}`}>
                    <GenreIcon iconKey={genre.icon_key} className="h-7 w-7" strokeWidth={2.5} />
                  </div>
                  <div>
                    <p className="text-xl font-black text-zinc-900">{genre.name}</p>
                    <p className="text-sm font-bold text-zinc-700">{genre.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
