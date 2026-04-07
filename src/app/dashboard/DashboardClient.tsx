'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, LogOut, Shield, Sparkles, Star, UserRound, Users } from 'lucide-react';
import { getBrowserSupabaseClient } from '@/lib/auth/browser';
import { GenreIcon } from '@/components/GenreIcon';
import QuizlyLogo from '@/components/QuizlyLogo';
import { resolveSubjectTone } from '@/lib/ui/subjectTone';
import type { DashboardActiveChild, StudyStatus } from '@/lib/auth/data';
import type { BadgeSummary } from '@/lib/badges/overview';

interface Genre {
  id: string;
  name: string;
  icon_key: string;
  description: string | null;
  color_hint: string | null;
  parent_id: string | null;
  question_count: number;
}

export default function DashboardClient({
  activeChild,
  canSwitchChild,
  genres,
  studyStatusByGenreId,
  badgeSummary,
}: {
  activeChild: DashboardActiveChild;
  canSwitchChild: boolean;
  genres: Genre[];
  studyStatusByGenreId: Record<string, StudyStatus>;
  badgeSummary: BadgeSummary | null;
}) {
  const router = useRouter();
  const supabase = getBrowserSupabaseClient();
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);

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

  const handleSwitchChild = async () => {
    await fetch('/api/session/child/logout', { method: 'POST' });
    router.push('/');
  };

  const handleParentLogout = async () => {
    await fetch('/api/session/child/logout', { method: 'POST' });
    await supabase.auth.signOut();
    router.push('/');
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-1 sm:gap-8 sm:p-2">
      <div className="flex justify-center">
        <QuizlyLogo
          variant="horizontal"
          theme="light"
          className="h-auto w-full max-w-[148px] sm:max-w-[168px]"
        />
      </div>

      <header className="w-full rounded-[2rem] border-4 border-zinc-400 bg-white p-4 shadow-brutal sm:p-6">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-4 border-zinc-400 bg-slate-200 text-zinc-900 shadow-brutal-sm sm:h-14 sm:w-14">
            <UserRound className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-[clamp(1.25rem,5.5vw,1.9rem)] font-black tracking-wide text-zinc-800">
              {activeChild.display_name} さん
            </h1>
            <p className="mt-1 inline-flex items-center gap-2 text-sm font-bold text-slate-600 sm:text-base">
              今日も学習を進めよう
              <Sparkles className="h-4 w-4" />
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="inline-flex h-11 max-w-full items-center gap-1.5 rounded-xl border-2 border-zinc-300 bg-white px-3 shadow-brutal-sm sm:gap-2 sm:px-3.5">
              <Star className="h-4 w-4 shrink-0 text-amber-600 fill-amber-300" />
              <span className="text-xs font-black text-zinc-700 sm:text-sm">保有ポイント</span>
              <span className="text-base font-black tabular-nums text-zinc-900 sm:text-lg">{activeChild.total_points.toLocaleString()}</span>
              <span className="text-xs font-black text-zinc-700 sm:text-sm">pt</span>
            </span>
            {badgeSummary && (
              <>
                <span className="inline-flex h-11 items-center gap-1.5 text-sm font-black text-amber-900">
                  <Sparkles className="h-3.5 w-3.5" />
                  連続{badgeSummary.current_streak}日
                </span>
                <span
                  className="inline-flex h-11 items-center gap-1.5 text-sm font-black text-zinc-700"
                  aria-label={`手に入れたバッジ ${badgeSummary.unlocked_count}個`}
                >
                  <span aria-hidden>🏅</span>
                  <span>バッジ {badgeSummary.unlocked_count}</span>
                </span>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => router.push('/history')}
              className="min-h-11 whitespace-nowrap rounded-lg border-2 border-emerald-400 bg-emerald-500 px-3 py-2 text-sm font-black text-white transition-colors hover:bg-emerald-600"
            >
              学習記録
            </button>

            <button
              onClick={() => router.push('/parent')}
              className="min-h-11 whitespace-nowrap rounded-lg border-2 border-zinc-300 bg-white px-3 py-2 text-sm font-black text-zinc-700 transition-colors hover:bg-zinc-100"
            >
              <span className="inline-flex items-center gap-1">
                <Shield className="h-4 w-4" />
                保護者管理
              </span>
            </button>

            {canSwitchChild && (
              <button
                onClick={handleSwitchChild}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border-2 border-zinc-300 bg-white px-3 py-2 text-zinc-700 transition-colors hover:bg-zinc-100"
                title="子を切り替える"
                aria-label="子を切り替える"
              >
                <Users className="h-5 w-5" />
              </button>
            )}

            <button
              onClick={handleParentLogout}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border-2 border-zinc-300 bg-white px-3 py-2 text-zinc-700 transition-colors hover:bg-zinc-100"
              title="保護者ログアウト"
              aria-label="保護者ログアウト"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
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
                  className={`group relative flex w-full items-start gap-3 overflow-hidden rounded-[2rem] border-4 border-zinc-400 p-4 pr-3 text-left text-zinc-900 shadow-brutal transition-all hover:-translate-y-1 hover:shadow-brutal-lg ${tone.focusRingClass} ${tone.cardClass} sm:pr-4`}
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
              const hasChildren = genres.some((childGenre) => childGenre.parent_id === genre.id);
              return (
                <button
                  key={genre.id}
                  onClick={() => hasChildren && setSelectedParentId(genre.id)}
                  disabled={!hasChildren}
                  aria-disabled={!hasChildren}
                  className={`group relative flex w-full items-center gap-3 overflow-hidden rounded-[2rem] border-4 border-zinc-400 p-4 text-left text-zinc-900 shadow-brutal transition-all sm:gap-6 sm:p-6 ${
                    hasChildren
                      ? `hover:-translate-y-1 hover:shadow-brutal-lg ${tone.focusRingClass} ${tone.cardClass}`
                      : 'cursor-not-allowed opacity-70'
                  }`}
                >
                  <div className={`absolute left-0 top-0 h-full w-4 ${tone.stripClass}`} />
                  <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/20 transition-transform duration-500 group-hover:scale-150" />
                  <div className={`z-10 flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.2rem] border-4 border-zinc-400 text-4xl shadow-brutal-sm transition-all group-hover:rotate-6 group-hover:scale-110 sm:h-24 sm:w-24 sm:rounded-[1.5rem] sm:text-5xl ${tone.iconBgClass}`}>
                    <GenreIcon iconKey={genre.icon_key} className="h-8 w-8 sm:h-10 sm:w-10" strokeWidth={2.5} />
                  </div>
                  <div className="z-10 min-w-0 flex-1">
                    <h3 className="font-display text-[1.45rem] font-black leading-tight tracking-wide sm:text-[1.9rem]">{genre.name}</h3>
                    <p className="mt-2 text-sm font-bold text-zinc-700/85 sm:text-base">{genre.description}</p>
                    {!hasChildren && (
                      <p className="mt-2 inline-flex rounded-full border-2 border-zinc-300 bg-white/85 px-3 py-1 text-xs font-black text-zinc-600">
                        準備中
                      </p>
                    )}
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
