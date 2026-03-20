'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CircleAlert, Circle, LogOut, Sparkles, Star, ChevronLeft, Check, CheckCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { GenreIcon } from '@/components/GenreIcon';
import { ICON_SIZE, ICON_STROKE } from '@/lib/ui/iconTokens';
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

export default function DashboardClient({ genres }: { genres: Genre[] }) {
  const router = useRouter();
  const [userName, setUserName] = useState<string | null>(null);
  const [totalPoints, setTotalPoints] = useState<number>(0);
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [studyStatusByGenreId, setStudyStatusByGenreId] = useState<Record<string, 'unattempted' | 'studied_not_perfect' | 'perfect_cleared'>>({});
  const [isStudyStatusLoaded, setIsStudyStatusLoaded] = useState(false);

  useEffect(() => {
    const userId = localStorage.getItem('quizly_user_id');

    if (!userId) {
      router.push('/');
    } else {
      const fetchDashboardMeta = async () => {
        const [{ data: userData }, { data: sessionsData }] = await Promise.all([
          supabase
            .from('users')
            .select('name, total_points')
            .eq('id', userId)
            .single(),
          supabase
            .from('study_sessions')
            .select('genre_id, correct_count, total_questions')
            .eq('user_id', userId),
        ]);

        if (userData?.name) {
          setUserName(userData.name);
        }
        if (userData?.total_points != null) {
          setTotalPoints(userData.total_points);
        }

        const statusMap: Record<string, 'unattempted' | 'studied_not_perfect' | 'perfect_cleared'> = {};
        for (const session of sessionsData ?? []) {
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
        setIsStudyStatusLoaded(true);
      };

      void fetchDashboardMeta();
    }
  }, [router]);

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
  const getStudyStatusIcon = (status: 'unattempted' | 'studied_not_perfect' | 'perfect_cleared') => {
    if (status === 'perfect_cleared') {
      return (
        <span className="shrink-0 w-10 h-10 rounded-full border-2 border-zinc-400 bg-teal-200 text-teal-800 inline-flex items-center justify-center" title="受講済み（全問正解達成）" aria-label="受講済み（全問正解達成）">
          <CheckCheck className={ICON_SIZE.md} strokeWidth={ICON_STROKE.bold} />
        </span>
      );
    }

    if (status === 'studied_not_perfect') {
      return (
        <span className="shrink-0 w-10 h-10 rounded-full border-2 border-zinc-400 bg-zinc-200 text-zinc-700 inline-flex items-center justify-center" title="受講済み（不正解あり）" aria-label="受講済み（不正解あり）">
          <Check className={ICON_SIZE.md} strokeWidth={ICON_STROKE.bold} />
        </span>
      );
    }

    return (
      <span className="shrink-0 w-10 h-10 rounded-full border-2 border-zinc-400 bg-white/80 text-zinc-500 inline-flex items-center justify-center" title="未受講" aria-label="未受講">
        <Circle className={ICON_SIZE.md} strokeWidth={ICON_STROKE.bold} />
      </span>
    );
  };

  const handleLogout = () => {
    localStorage.removeItem('quizly_user_id');
    localStorage.removeItem('quizly_user_name');
    router.push('/');
  };

  if (!userName) {
    return null;
  }

  return (
    <div className="flex flex-col gap-8 w-full max-w-4xl mx-auto p-4 sm:p-8">
      <header className="flex justify-between items-center bg-white p-4 sm:p-6 rounded-[2rem] border-4 border-zinc-400 shadow-brutal w-full">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 sm:w-16 sm:h-16 bg-teal-300 rounded-full flex items-center justify-center text-3xl font-black text-zinc-900 border-4 border-zinc-400 shadow-brutal-sm animate-bounce-soft">
            {userName.charAt(0)}
          </div>
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-black text-zinc-800 tracking-wide">{userName}さんのトップページ</h1>
            <p className="text-md sm:text-lg font-bold text-teal-600 mt-1 inline-flex items-center gap-2">
              今日も学習を進めよう
              <Sparkles className={ICON_SIZE.sm} strokeWidth={ICON_STROKE.strong} />
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="p-3 bg-red-100 rounded-2xl border-4 border-zinc-400 shadow-brutal text-red-600 hover:bg-red-200 active-brutal-push focus:outline-none focus:ring-4 focus:ring-red-400 group transition-colors"
          title="ログアウト"
        >
          <LogOut className="h-6 w-6 group-hover:-translate-x-1 group-hover:scale-110 transition-transform" />
        </button>
      </header>

      <div className="flex justify-center -mt-4">
        <div className="inline-flex items-center gap-3 bg-gradient-to-r from-teal-100 to-teal-200 px-8 py-3 rounded-full border-4 border-teal-400 shadow-brutal transform rotate-1 hover:-rotate-1 transition-transform">
          <Star className="w-7 h-7 text-teal-600 fill-teal-400" />
          <span className="text-xl sm:text-2xl font-black text-teal-900">保有ポイント</span>
          <span className="text-3xl sm:text-4xl font-black text-teal-700 tabular-nums">{totalPoints.toLocaleString()}</span>
          <span className="text-xl sm:text-2xl font-black text-teal-900">pt</span>
        </div>
      </div>

      <section className="flex flex-col gap-6 w-full">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-2xl font-black text-zinc-800 bg-white inline-block px-6 py-2 rounded-full border-4 border-zinc-400 shadow-brutal w-fit transform -rotate-1">
            学習を開始する
          </h2>
          {selectedParent && (
            <button
              onClick={() => setSelectedParentId(null)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full border-4 border-zinc-400 bg-white shadow-brutal-sm font-black text-zinc-700 hover:bg-zinc-50 active-brutal-push"
            >
              <ChevronLeft className={ICON_SIZE.sm} />
              教科選択に戻る
            </button>
          )}
        </div>

        {selectedParent ? (
          <div className="flex flex-col gap-4">
            <div className="bg-white p-4 rounded-2xl border-4 border-zinc-400 shadow-brutal-sm">
              <p className="text-lg sm:text-xl font-black text-zinc-800 inline-flex items-center gap-2">
                <GenreIcon
                  iconKey={selectedParent.icon_key}
                  className={ICON_SIZE.md}
                  strokeWidth={ICON_STROKE.medium}
                />
                {selectedParent.name} のカテゴリを選択
              </p>
            </div>
            <div className="grid grid-cols-1 gap-5 w-full">
              {childGenres.map((genre) => {
                const tone = resolveSubjectTone(selectedParent?.id ?? genre.parent_id, genre.color_hint);
                const studyStatus = studyStatusByGenreId[genre.id] ?? 'unattempted';
                return (
                  <button
                    key={genre.id}
                    onClick={() => router.push(`/quiz?genre=${genre.id}`)}
                    className={`w-full text-left rounded-[2rem] border-4 border-zinc-400 bg-white hover:bg-slate-50 text-zinc-900 shadow-brutal hover:-translate-y-2 hover:shadow-brutal-lg transition-all active-brutal-push focus:outline-none focus:ring-4 ${tone.focusRingClass} p-5 sm:p-6 flex items-start gap-4 sm:gap-5 group overflow-hidden relative`}
                  >
                    <div className={`absolute left-0 top-0 h-full w-4 ${tone.stripClass}`} />
                    <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/20 rounded-full transform group-hover:scale-150 transition-transform duration-500" />
                    <div className={`shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-[1.5rem] flex items-center justify-center text-5xl border-4 border-zinc-400 shadow-brutal-sm z-10 group-hover:rotate-6 group-hover:scale-110 transition-all ${tone.iconBgClass}`}>
                      <GenreIcon
                        iconKey={genre.icon_key}
                        className={ICON_SIZE.card}
                        strokeWidth={ICON_STROKE.medium}
                      />
                    </div>
                    <div className="flex-1 min-w-0 z-10">
                      <h3
                        className="font-display text-xl sm:text-2xl font-black tracking-wide drop-shadow-sm leading-tight overflow-hidden [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]"
                        title={genre.name}
                      >
                        {genre.name}
                      </h3>
                      <p
                        className="mt-2 text-sm sm:text-base font-bold opacity-80 leading-snug overflow-hidden [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]"
                        title={genre.description ?? ''}
                      >
                        {genre.description}
                      </p>
                      <p className={`mt-3 inline-flex items-center rounded-full border-2 px-3 py-1 text-sm sm:text-base font-black ${tone.badgeClass}`}>
                        全{genre.question_count}問
                      </p>
                    </div>
                    <div className="shrink-0 z-10 min-h-full flex flex-col items-end justify-between gap-3">
                      {isStudyStatusLoaded ? getStudyStatusIcon(studyStatus) : (
                        <span className="shrink-0 w-10 h-10 rounded-full border-2 border-zinc-300 bg-zinc-100 animate-pulse" />
                      )}
                      <div className={`text-4xl sm:text-5xl font-black opacity-60 group-hover:opacity-100 group-hover:translate-x-2 transition-all ${tone.arrowClass}`}>→</div>
                    </div>
                  </button>
                );
              })}

              {childGenres.length === 0 && (
                <div className="col-span-full p-12 text-center bg-white border-4 border-dashed border-zinc-400 rounded-[2rem] shadow-brutal">
                  <p className="text-2xl font-bold text-zinc-500 inline-flex items-center gap-2">
                    <CircleAlert className={ICON_SIZE.md} strokeWidth={ICON_STROKE.medium} />
                    この教科のカテゴリはまだありません
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
            {parentGenres.map((genre) => {
              const tone = resolveSubjectTone(genre.id, genre.color_hint);
              return (
                <button
                  key={genre.id}
                  onClick={() => setSelectedParentId(genre.id)}
                  className={`w-full text-left rounded-[2rem] border-4 border-zinc-400 bg-white hover:bg-slate-50 text-zinc-900 shadow-brutal hover:-translate-y-2 hover:shadow-brutal-lg transition-all active-brutal-push focus:outline-none focus:ring-4 ${tone.focusRingClass} p-6 flex items-center gap-6 group overflow-hidden relative`}
                >
                  <div className={`absolute left-0 top-0 h-full w-4 ${tone.stripClass}`} />
                  <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/20 rounded-full transform group-hover:scale-150 transition-transform duration-500" />
                  <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-[1.5rem] flex items-center justify-center text-5xl border-4 border-zinc-400 shadow-brutal-sm z-10 group-hover:rotate-6 group-hover:scale-110 transition-all ${tone.iconBgClass}`}>
                    <GenreIcon
                      iconKey={genre.icon_key}
                      className={ICON_SIZE.card}
                      strokeWidth={ICON_STROKE.medium}
                    />
                  </div>
                  <div className="flex-1 z-10">
                    <h3 className="font-display text-2xl sm:text-3xl font-black mb-2 tracking-wide drop-shadow-sm">{genre.name}</h3>
                    <p className="text-md sm:text-lg font-bold opacity-80">{genre.description}</p>
                  </div>
                  <div className={`text-5xl font-black opacity-60 group-hover:opacity-100 group-hover:translate-x-2 transition-all z-10 ${tone.arrowClass}`}>→</div>
                </button>
              );
            })}

            {parentGenres.length === 0 && (
              <div className="col-span-full p-12 text-center bg-white border-4 border-dashed border-zinc-400 rounded-[2rem] shadow-brutal">
                <p className="text-2xl font-bold text-zinc-500 inline-flex items-center gap-2">
                  <CircleAlert className={ICON_SIZE.md} strokeWidth={ICON_STROKE.medium} />
                  教科がまだありません
                </p>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
