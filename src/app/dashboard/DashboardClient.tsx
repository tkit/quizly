'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CircleAlert, Circle, Construction, LogOut, Sparkles, Star, ChevronLeft, Check, CheckCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { GenreIcon } from '@/components/GenreIcon';
import { ICON_SIZE, ICON_STROKE } from '@/lib/ui/iconTokens';

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
        <span className="shrink-0 w-10 h-10 rounded-full border-2 border-zinc-400 bg-green-200 text-green-800 inline-flex items-center justify-center" title="受講済み（全問正解達成）" aria-label="受講済み（全問正解達成）">
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

  const getGenreStyle = (colorHint: string | null) => {
    if (colorHint === 'orange') {
      return {
        baseColorClass: 'bg-orange-100 hover:bg-orange-200 text-orange-800',
        iconBgClass: 'bg-orange-300',
      };
    }
    if (colorHint === 'green') {
      return {
        baseColorClass: 'bg-green-100 hover:bg-green-200 text-green-800',
        iconBgClass: 'bg-green-300',
      };
    }
    if (colorHint === 'pink') {
      return {
        baseColorClass: 'bg-pink-100 hover:bg-pink-200 text-pink-800',
        iconBgClass: 'bg-pink-300',
      };
    }
    if (colorHint === 'purple') {
      return {
        baseColorClass: 'bg-purple-100 hover:bg-purple-200 text-purple-800',
        iconBgClass: 'bg-purple-300',
      };
    }

    return {
      baseColorClass: 'bg-blue-100 hover:bg-blue-200 text-blue-800',
      iconBgClass: 'bg-blue-300',
    };
  };

  if (!userName) {
    return null;
  }

  return (
    <div className="flex flex-col gap-8 w-full max-w-4xl mx-auto p-4 sm:p-8">
      <header className="flex justify-between items-center bg-white p-4 sm:p-6 rounded-[2rem] border-4 border-zinc-400 shadow-brutal w-full">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 sm:w-16 sm:h-16 bg-yellow-300 rounded-full flex items-center justify-center text-3xl font-black text-zinc-900 border-4 border-zinc-400 shadow-brutal-sm animate-bounce-soft">
            {userName.charAt(0)}
          </div>
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-black text-zinc-800 tracking-wide">{userName}さんのトップページ</h1>
            <p className="text-md sm:text-lg font-bold text-pink-500 mt-1 inline-flex items-center gap-2">
              きょうも がんばろう！
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
        <div className="inline-flex items-center gap-3 bg-gradient-to-r from-amber-100 to-yellow-200 px-8 py-3 rounded-full border-4 border-amber-400 shadow-brutal transform rotate-1 hover:-rotate-1 transition-transform">
          <Star className="w-7 h-7 text-amber-500 fill-amber-400" />
          <span className="text-xl sm:text-2xl font-black text-amber-800">もっているポイント</span>
          <span className="text-3xl sm:text-4xl font-black text-amber-600 tabular-nums">{totalPoints.toLocaleString()}</span>
          <span className="text-xl sm:text-2xl font-black text-amber-800">pt</span>
        </div>
      </div>

      <section className="flex flex-col gap-6 w-full">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-2xl font-black text-zinc-800 bg-white inline-block px-6 py-2 rounded-full border-4 border-zinc-400 shadow-brutal w-fit transform -rotate-1">
            がくしゅうを おこなう！
          </h2>
          {selectedParent && (
            <button
              onClick={() => setSelectedParentId(null)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full border-4 border-zinc-400 bg-white shadow-brutal-sm font-black text-zinc-700 hover:bg-zinc-50 active-brutal-push"
            >
              <ChevronLeft className={ICON_SIZE.sm} />
              きょうか えらびに もどる
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
                {selectedParent.name} のカテゴリを えらぼう！
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
              {childGenres.map((genre) => {
                const styles = getGenreStyle(genre.color_hint);
                const studyStatus = studyStatusByGenreId[genre.id] ?? 'unattempted';
                return (
                  <button
                    key={genre.id}
                    onClick={() => router.push(`/quiz?genre=${genre.id}`)}
                    className={`w-full text-left rounded-[2rem] border-4 border-zinc-400 shadow-brutal hover:-translate-y-2 hover:shadow-brutal-lg transition-all active-brutal-push focus:outline-none focus:ring-4 focus:ring-blue-400 p-6 flex items-center gap-6 group overflow-hidden relative ${styles.baseColorClass}`}
                  >
                    <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/20 rounded-full transform group-hover:scale-150 transition-transform duration-500" />
                    <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-[1.5rem] flex items-center justify-center text-5xl border-4 border-zinc-400 shadow-brutal-sm z-10 group-hover:rotate-6 group-hover:scale-110 transition-all ${styles.iconBgClass}`}>
                      <GenreIcon
                        iconKey={genre.icon_key}
                        className={ICON_SIZE.card}
                        strokeWidth={ICON_STROKE.medium}
                      />
                    </div>
                    <div className="flex-1 z-10">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <h3 className="font-display text-2xl sm:text-3xl font-black tracking-wide drop-shadow-sm">{genre.name}</h3>
                        {isStudyStatusLoaded ? getStudyStatusIcon(studyStatus) : (
                          <span className="shrink-0 w-10 h-10 rounded-full border-2 border-zinc-300 bg-zinc-100 animate-pulse" />
                        )}
                      </div>
                      <p className="text-md sm:text-lg font-bold opacity-80">{genre.description}</p>
                      <p className="mt-2 inline-flex items-center rounded-full border-2 border-zinc-400 bg-white/80 px-3 py-1 text-sm sm:text-base font-black text-zinc-700">
                        全{genre.question_count}問
                      </p>
                    </div>
                    <div className="text-5xl font-black opacity-30 group-hover:opacity-100 group-hover:translate-x-2 transition-all z-10">→</div>
                  </button>
                );
              })}

              {childGenres.length === 0 && (
                <div className="col-span-full p-12 text-center bg-white border-4 border-dashed border-zinc-400 rounded-[2rem] shadow-brutal">
                  <p className="text-2xl font-bold text-zinc-500 inline-flex items-center gap-2">
                    <CircleAlert className={ICON_SIZE.md} strokeWidth={ICON_STROKE.medium} />
                    このきょうかのカテゴリは まだありません
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
            {parentGenres.map((genre) => {
              const styles = getGenreStyle(genre.color_hint);
              return (
                <button
                  key={genre.id}
                  onClick={() => setSelectedParentId(genre.id)}
                  className={`w-full text-left rounded-[2rem] border-4 border-zinc-400 shadow-brutal hover:-translate-y-2 hover:shadow-brutal-lg transition-all active-brutal-push focus:outline-none focus:ring-4 focus:ring-blue-400 p-6 flex items-center gap-6 group overflow-hidden relative ${styles.baseColorClass}`}
                >
                  <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/20 rounded-full transform group-hover:scale-150 transition-transform duration-500" />
                  <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-[1.5rem] flex items-center justify-center text-5xl border-4 border-zinc-400 shadow-brutal-sm z-10 group-hover:rotate-6 group-hover:scale-110 transition-all ${styles.iconBgClass}`}>
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
                  <div className="text-5xl font-black opacity-30 group-hover:opacity-100 group-hover:translate-x-2 transition-all z-10">→</div>
                </button>
              );
            })}

            {parentGenres.length === 0 && (
              <div className="col-span-full p-12 text-center bg-white border-4 border-dashed border-zinc-400 rounded-[2rem] shadow-brutal">
                <p className="text-2xl font-bold text-zinc-500 inline-flex items-center gap-2">
                  <CircleAlert className={ICON_SIZE.md} strokeWidth={ICON_STROKE.medium} />
                  きょうかが まだありません
                </p>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="mt-4 bg-yellow-300 p-6 rounded-[2rem] border-4 border-zinc-400 shadow-brutal transform rotate-1 w-full max-w-2xl mx-auto">
        <div className="flex flex-col gap-2 items-center text-center">
          <h2 className="font-display text-2xl font-black text-zinc-900 bg-white px-6 py-2 rounded-xl border-4 border-zinc-400 shadow-brutal-sm -rotate-2">
            これまでのきろく
          </h2>
          <p className="text-xl font-bold text-zinc-800 mt-2 inline-flex items-center gap-2">
            （※いまはまだ じゅんび中だよ！）
            <Construction className={ICON_SIZE.md} strokeWidth={ICON_STROKE.strong} />
          </p>
        </div>
      </section>
    </div>
  );
}
