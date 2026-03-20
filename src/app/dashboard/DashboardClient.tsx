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
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-zinc-400 bg-teal-200 text-teal-800 sm:h-10 sm:w-10" title="受講済み（全問正解達成）" aria-label="受講済み（全問正解達成）">
          <CheckCheck className={ICON_SIZE.md} strokeWidth={ICON_STROKE.bold} />
        </span>
      );
    }

    if (status === 'studied_not_perfect') {
      return (
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-zinc-400 bg-zinc-200 text-zinc-700 sm:h-10 sm:w-10" title="受講済み（不正解あり）" aria-label="受講済み（不正解あり）">
          <Check className={ICON_SIZE.md} strokeWidth={ICON_STROKE.bold} />
        </span>
      );
    }

    return (
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-zinc-400 bg-white/80 text-zinc-500 sm:h-10 sm:w-10" title="未受講" aria-label="未受講">
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
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-1 sm:gap-8 sm:p-2">
      <header className="flex w-full flex-col gap-4 rounded-[2rem] border-4 border-zinc-400 bg-white p-4 shadow-brutal sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-4 border-zinc-400 bg-teal-300 text-2xl font-black text-zinc-900 shadow-brutal-sm animate-bounce-soft sm:h-16 sm:w-16 sm:text-3xl">
            {userName.charAt(0)}
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-[clamp(1.25rem,5.5vw,1.9rem)] font-black tracking-wide text-zinc-800">{userName}さんのトップページ</h1>
            <p className="mt-1 inline-flex items-center gap-2 text-sm font-bold text-teal-600 sm:text-lg">
              今日も学習を進めよう
              <Sparkles className={ICON_SIZE.sm} strokeWidth={ICON_STROKE.strong} />
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="group flex min-h-11 min-w-11 items-center justify-center self-end rounded-2xl border-4 border-zinc-400 bg-amber-100 p-2.5 text-amber-700 shadow-brutal transition-colors hover:bg-amber-200 active-brutal-push focus:ring-4 focus:ring-amber-400 focus:outline-none sm:self-auto sm:p-3"
          title="ログアウト"
        >
          <LogOut className="h-6 w-6 group-hover:-translate-x-1 group-hover:scale-110 transition-transform" />
        </button>
      </header>

      <div className="flex justify-center sm:-mt-2">
        <div className="inline-flex max-w-full flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-full border-4 border-teal-400 bg-gradient-to-r from-teal-100 to-teal-200 px-5 py-2.5 text-center shadow-brutal transition-transform hover:-rotate-1 sm:rotate-1 sm:px-8 sm:py-3 sm:gap-3">
          <Star className="h-6 w-6 text-teal-600 fill-teal-400 sm:h-7 sm:w-7" />
          <span className="text-lg font-black text-teal-900 sm:text-2xl">保有ポイント</span>
          <span className="text-2xl font-black tabular-nums text-teal-700 sm:text-4xl">{totalPoints.toLocaleString()}</span>
          <span className="text-lg font-black text-teal-900 sm:text-2xl">pt</span>
        </div>
      </div>

      <section className="flex flex-col gap-6 w-full">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display inline-block w-fit -rotate-1 rounded-full border-4 border-zinc-400 bg-white px-4 py-2 text-xl font-black text-zinc-800 shadow-brutal sm:px-6 sm:text-2xl">
            学習を開始する
          </h2>
          {selectedParent && (
            <button
              onClick={() => setSelectedParentId(null)}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border-4 border-zinc-400 bg-white px-4 py-2 text-sm font-black text-zinc-700 shadow-brutal-sm hover:bg-zinc-50 active-brutal-push sm:text-base"
            >
              <ChevronLeft className={ICON_SIZE.sm} />
              教科選択に戻る
            </button>
          )}
        </div>

        {selectedParent ? (
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border-4 border-zinc-400 bg-white p-4 shadow-brutal-sm">
              <p className="inline-flex items-center gap-2 text-base font-black text-zinc-800 sm:text-xl">
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
                    className={`group relative flex w-full items-start gap-3 overflow-hidden rounded-[2rem] border-4 border-zinc-400 bg-white p-4 text-left text-zinc-900 shadow-brutal transition-all hover:-translate-y-1 hover:bg-slate-50 hover:shadow-brutal-lg active-brutal-push focus:ring-4 focus:outline-none ${tone.focusRingClass} sm:gap-5 sm:p-6`}
                  >
                    <div className={`absolute left-0 top-0 h-full w-4 ${tone.stripClass}`} />
                    <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/20 rounded-full transform group-hover:scale-150 transition-transform duration-500" />
                    <div className={`z-10 flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.2rem] border-4 border-zinc-400 text-4xl shadow-brutal-sm transition-all group-hover:rotate-6 group-hover:scale-110 sm:h-24 sm:w-24 sm:rounded-[1.5rem] sm:text-5xl ${tone.iconBgClass}`}>
                      <GenreIcon
                        iconKey={genre.icon_key}
                        className={ICON_SIZE.card}
                        strokeWidth={ICON_STROKE.medium}
                      />
                    </div>
                    <div className="flex-1 min-w-0 z-10">
                      <h3
                        className="font-display overflow-hidden text-lg font-black leading-tight tracking-wide drop-shadow-sm [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] sm:text-2xl"
                        title={genre.name}
                      >
                        {genre.name}
                      </h3>
                      <p
                        className="mt-1.5 overflow-hidden text-sm font-bold leading-snug opacity-80 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] sm:mt-2 sm:text-base"
                        title={genre.description ?? ''}
                      >
                        {genre.description}
                      </p>
                      <p className={`mt-2 inline-flex items-center rounded-full border-2 px-3 py-1 text-xs font-black sm:mt-3 sm:text-base ${tone.badgeClass}`}>
                        全{genre.question_count}問
                      </p>
                    </div>
                    <div className="z-10 hidden min-h-full shrink-0 flex-col items-end justify-between gap-3 sm:flex">
                      {isStudyStatusLoaded ? getStudyStatusIcon(studyStatus) : (
                        <span className="h-10 w-10 shrink-0 animate-pulse rounded-full border-2 border-zinc-300 bg-zinc-100" />
                      )}
                      <div className={`text-4xl font-black opacity-60 transition-all group-hover:translate-x-2 group-hover:opacity-100 sm:text-5xl ${tone.arrowClass}`}>→</div>
                    </div>
                  </button>
                );
              })}

              {childGenres.length === 0 && (
                <div className="col-span-full rounded-[2rem] border-4 border-dashed border-zinc-400 bg-white p-8 text-center shadow-brutal sm:p-12">
                  <p className="inline-flex items-center gap-2 text-lg font-bold text-zinc-500 sm:text-2xl">
                    <CircleAlert className={ICON_SIZE.md} strokeWidth={ICON_STROKE.medium} />
                    この教科のカテゴリはまだありません
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="grid w-full grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2">
            {parentGenres.map((genre) => {
              const tone = resolveSubjectTone(genre.id, genre.color_hint);
              return (
                <button
                  key={genre.id}
                  onClick={() => setSelectedParentId(genre.id)}
                  className={`group relative flex w-full items-center gap-4 overflow-hidden rounded-[2rem] border-4 border-zinc-400 bg-white p-4 text-left text-zinc-900 shadow-brutal transition-all hover:-translate-y-1 hover:bg-slate-50 hover:shadow-brutal-lg active-brutal-push focus:ring-4 focus:outline-none ${tone.focusRingClass} sm:gap-6 sm:p-6`}
                >
                  <div className={`absolute left-0 top-0 h-full w-4 ${tone.stripClass}`} />
                  <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/20 rounded-full transform group-hover:scale-150 transition-transform duration-500" />
                  <div className={`z-10 flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.2rem] border-4 border-zinc-400 text-4xl shadow-brutal-sm transition-all group-hover:rotate-6 group-hover:scale-110 sm:h-24 sm:w-24 sm:rounded-[1.5rem] sm:text-5xl ${tone.iconBgClass}`}>
                    <GenreIcon
                      iconKey={genre.icon_key}
                      className={ICON_SIZE.card}
                      strokeWidth={ICON_STROKE.medium}
                    />
                  </div>
                  <div className="z-10 min-w-0 flex-1">
                    <h3 className="font-display mb-1 text-xl font-black tracking-wide drop-shadow-sm sm:mb-2 sm:text-3xl">{genre.name}</h3>
                    <p className="text-sm font-bold opacity-80 sm:text-lg">{genre.description}</p>
                  </div>
                  <div className={`z-10 hidden text-5xl font-black opacity-60 transition-all group-hover:translate-x-2 group-hover:opacity-100 sm:block ${tone.arrowClass}`}>→</div>
                </button>
              );
            })}

            {parentGenres.length === 0 && (
              <div className="col-span-full rounded-[2rem] border-4 border-dashed border-zinc-400 bg-white p-8 text-center shadow-brutal sm:p-12">
                <p className="inline-flex items-center gap-2 text-lg font-bold text-zinc-500 sm:text-2xl">
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
