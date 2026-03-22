'use client';

import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, LogOut, Shield, Sparkles, Star, UserRound } from 'lucide-react';
import { getBrowserSupabaseClient } from '@/lib/auth/browser';
import { clearDashboardSnapshot, preloadDashboardSnapshot, readDashboardSnapshot, type DashboardActiveChild, type StudyStatus } from '@/lib/auth/dashboardPreload';
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

function DashboardSkeleton({ genres }: { genres: Genre[] }) {
  const parentGenres = genres.filter((genre) => genre.parent_id == null);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-1 sm:gap-8 sm:p-2 animate-pulse">
      <header className="flex w-full flex-col gap-4 rounded-[2rem] border-4 border-zinc-400 bg-white p-4 shadow-brutal sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <div className="flex h-12 w-12 shrink-0 rounded-full border-4 border-zinc-400 bg-zinc-200 shadow-brutal-sm sm:h-14 sm:w-14" />
          <div className="min-w-0 space-y-2">
            <div className="h-7 w-40 rounded-full bg-zinc-200 sm:w-56" />
            <div className="h-5 w-32 rounded-full bg-teal-100 sm:w-40" />
          </div>
        </div>
        <div className="flex gap-2 self-end sm:self-auto">
          <div className="h-11 w-28 rounded-xl border-2 border-zinc-300 bg-zinc-100" />
          <div className="h-11 w-28 rounded-xl border-2 border-zinc-300 bg-zinc-100" />
          <div className="h-11 w-11 rounded-2xl border-4 border-zinc-400 bg-amber-100" />
        </div>
      </header>

      <div className="flex justify-center sm:-mt-2">
        <div className="inline-flex w-full max-w-md items-center justify-center gap-3 rounded-full border-4 border-teal-400 bg-gradient-to-r from-teal-100 to-teal-200 px-5 py-3 shadow-brutal">
          <Star className="h-6 w-6 text-teal-500 sm:h-7 sm:w-7" />
          <div className="h-6 w-40 rounded-full bg-white/70" />
        </div>
      </div>

      <section className="flex w-full flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="h-12 w-52 rounded-full border-4 border-zinc-400 bg-white shadow-brutal" />
        </div>

        <div className="grid w-full grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2">
          {parentGenres.map((genre) => {
            const tone = resolveSubjectTone(genre.id, genre.color_hint);
            return (
              <div
                key={genre.id}
                className={`relative flex w-full items-center gap-3 overflow-hidden rounded-[2rem] border-4 border-zinc-400 bg-white p-4 shadow-brutal sm:gap-6 sm:p-6 ${tone.focusRingClass}`}
              >
                <div className={`absolute left-0 top-0 h-full w-4 ${tone.stripClass}`} />
                <div className={`z-10 flex h-16 w-16 shrink-0 rounded-[1.2rem] border-4 border-zinc-400 shadow-brutal-sm sm:h-24 sm:w-24 sm:rounded-[1.5rem] ${tone.iconBgClass}`} />
                <div className="z-10 flex min-w-0 flex-1 flex-col gap-3">
                  <div className="h-7 w-28 rounded-full bg-zinc-200 sm:w-36" />
                  <div className="h-4 w-full max-w-[14rem] rounded-full bg-zinc-100" />
                </div>
                <div className="z-10 h-12 w-12 shrink-0 rounded-full border-4 border-zinc-400 bg-white shadow-brutal-sm" />
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export default function DashboardClient({
  genres,
  initialActiveChildId,
}: {
  genres: Genre[];
  initialActiveChildId: string | null;
}) {
  const router = useRouter();
  const supabase = getBrowserSupabaseClient();

  const [activeChild, setActiveChild] = useState<DashboardActiveChild | null>(null);
  const [studyStatusByGenreId, setStudyStatusByGenreId] = useState<Record<string, StudyStatus>>({});
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

  useLayoutEffect(() => {
    const cachedSnapshot = readDashboardSnapshot();
    if (!cachedSnapshot) {
      return;
    }

    setActiveChild(cachedSnapshot.activeChild);
    setCanSwitchChild(cachedSnapshot.canSwitchChild);
    setStudyStatusByGenreId(cachedSnapshot.studyStatusByGenreId);
    setLoading(false);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadDashboard = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        if (!accessToken) {
          clearDashboardSnapshot();
          router.replace('/');
          return;
        }

        const snapshot = await preloadDashboardSnapshot({
          accessToken,
          childId: initialActiveChildId ?? undefined,
        });
        if (!snapshot) {
          clearDashboardSnapshot();
          router.replace('/');
          return;
        }

        if (!isMounted) {
          return;
        }

        setActiveChild(snapshot.activeChild);
        setCanSwitchChild(snapshot.canSwitchChild);
        setStudyStatusByGenreId(snapshot.studyStatusByGenreId);
      } catch (error) {
        console.error('loadDashboard failed:', error);
        clearDashboardSnapshot();
        router.replace('/');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadDashboard();

    return () => {
      isMounted = false;
    };
  }, [initialActiveChildId, router, supabase]);

  const handleSwitchChild = async () => {
    clearDashboardSnapshot();
    await fetch('/api/session/child/logout', { method: 'POST' });
    router.push('/');
  };

  const handleParentLogout = async () => {
    clearDashboardSnapshot();
    await fetch('/api/session/child/logout', { method: 'POST' });
    await supabase.auth.signOut();
    router.push('/');
  };

  if (loading || !activeChild) {
    return <DashboardSkeleton genres={genres} />;
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
            <p className="mt-1 inline-flex items-center gap-2 text-sm font-bold text-teal-600 sm:text-base">
              今日も学習を進めよう
              <Sparkles className="h-4 w-4" />
            </p>
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

      <div className="flex justify-center sm:-mt-2">
        <div className="inline-flex max-w-full flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-full border-4 border-teal-400 bg-gradient-to-r from-teal-100 to-teal-200 px-5 py-2.5 text-center shadow-brutal transition-transform hover:-rotate-1 sm:rotate-1 sm:px-8 sm:py-3 sm:gap-3">
          <Star className="h-6 w-6 text-teal-600 fill-teal-400 sm:h-7 sm:w-7" />
          <span className="text-lg font-black text-teal-900 sm:text-2xl">保有ポイント</span>
          <span className="text-2xl font-black tabular-nums text-teal-700 sm:text-4xl">{activeChild.total_points.toLocaleString()}</span>
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
                  className={`group relative flex w-full items-start gap-3 overflow-hidden rounded-[2rem] border-4 border-zinc-400 bg-white p-4 pr-3 text-left text-zinc-900 shadow-brutal transition-all hover:-translate-y-1 hover:bg-slate-50 hover:shadow-brutal-lg ${tone.focusRingClass} sm:pr-4`}
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
                  <div className="z-10 shrink-0 self-center">
                    <span className={`inline-flex h-11 w-11 items-center justify-center rounded-full border-4 border-zinc-400 bg-white text-zinc-600 shadow-brutal-sm transition-all group-hover:translate-x-1 sm:h-12 sm:w-12 ${tone.arrowClass}`}>
                      <ChevronRight className="h-5 w-5" />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="grid w-full grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2">
            {parentGenres.map((genre) => {
              const tone = resolveSubjectTone(genre.id, genre.color_hint);
              return (
                <button
                  key={genre.id}
                  onClick={() => setSelectedParentId(genre.id)}
                  className={`group relative flex w-full items-center gap-3 overflow-hidden rounded-[2rem] border-4 border-zinc-400 bg-white p-4 text-left text-zinc-900 shadow-brutal transition-all hover:-translate-y-1 hover:bg-slate-50 hover:shadow-brutal-lg ${tone.focusRingClass} sm:gap-6 sm:p-6`}
                >
                  <div className={`absolute left-0 top-0 h-full w-4 ${tone.stripClass}`} />
                  <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/20 transition-transform duration-500 group-hover:scale-150" />
                  <div className={`z-10 flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.2rem] border-4 border-zinc-400 text-4xl shadow-brutal-sm transition-all group-hover:rotate-6 group-hover:scale-110 sm:h-24 sm:w-24 sm:rounded-[1.5rem] sm:text-5xl ${tone.iconBgClass}`}>
                    <GenreIcon iconKey={genre.icon_key} className="h-8 w-8 sm:h-10 sm:w-10" strokeWidth={2.5} />
                  </div>
                  <div className="z-10 min-w-0 flex-1">
                    <h3 className="font-display text-[1.45rem] font-black leading-tight tracking-wide sm:text-[1.9rem]">{genre.name}</h3>
                    <p className="mt-2 text-sm font-bold text-zinc-700/85 sm:text-base">{genre.description}</p>
                  </div>
                  <div className="z-10 shrink-0 self-center">
                    <span className={`inline-flex h-11 w-11 items-center justify-center rounded-full border-4 border-zinc-400 bg-white text-zinc-600 shadow-brutal-sm transition-all group-hover:translate-x-1 sm:h-14 sm:w-14 ${tone.arrowClass}`}>
                      <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" />
                    </span>
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
