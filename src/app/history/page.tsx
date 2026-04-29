import Link from 'next/link';
import Image from 'next/image';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ArrowLeft, CalendarDays, Sparkles, Trophy } from 'lucide-react';
import PageShell from '@/components/layout/PageShell';
import MessageCard from '@/components/feedback/MessageCard';
import StudyHeatmap from '@/components/history/StudyHeatmap';
import { ACTIVE_CHILD_COOKIE } from '@/lib/auth/constants';
import { getD1ChildProfile } from '@/lib/auth/d1';
import { getAuthenticatedUser } from '@/lib/auth/server';
import { getD1BadgeOverview, type BadgeOverview } from '@/lib/badges/overview';
import { getOptionalD1Database } from '@/lib/cloudflare/d1';

type HistorySessionRow = {
  id: string;
  total_questions: number;
  correct_count: number;
  earned_points: number;
  started_at: string;
  completed_at: string | null;
  genres:
    | { id: string; name: string; parent_id: string | null; color_hint: string | null }
    | { id: string; name: string; parent_id: string | null; color_hint: string | null }[]
    | null;
};

type GenreMapRow = {
  id: string;
  name: string;
  parent_id: string | null;
  color_hint: string | null;
};

type StudyDayRow = {
  completed_at: string | null;
  started_at: string;
};

type D1HistorySessionRow = Omit<HistorySessionRow, 'genres'> & {
  genre_id: string | null;
  genre_name: string | null;
  genre_parent_id: string | null;
  genre_color_hint: string | null;
};

type StudyHeatmapCell = {
  dateKey: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
  column: number;
  weekday: number;
};

const TOKYO_TIMEZONE = 'Asia/Tokyo';
const HEATMAP_WEEKS = 26;
const WEEKDAY_INDEX_MAP: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function remainingUnit(family: string) {
  if (family === 'streak_days') return '日';
  if (family === 'genre_explorer') return '種類';
  if (family === 'total_points') return 'pt';
  return '回';
}

function compactTrackLabel(family: string) {
  if (family === 'streak_days') return '連続学習';
  if (family === 'perfect_sessions') return '全問正解';
  if (family === 'genre_explorer') return 'ジャンル挑戦';
  if (family === 'total_points') return 'ポイント';
  if (family === 'subject_master') return '教科特化';
  return 'チャレンジ';
}

function formatShortDate(value: string | null) {
  if (!value) return '日付不明';
  return new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
  }).format(new Date(value));
}

function formatDateLabel(value: string | null) {
  if (!value) return '日時未記録';
  return new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function subjectChipClass(subjectId: string | null) {
  if (subjectId === 'japanese') return 'border-rose-300 bg-rose-50 text-rose-900';
  if (subjectId === 'math') return 'border-blue-300 bg-blue-50 text-blue-900';
  if (subjectId === 'science') return 'border-orange-300 bg-orange-50 text-orange-900';
  if (subjectId === 'social') return 'border-green-300 bg-green-50 text-green-900';
  return 'border-zinc-300 bg-zinc-100 text-zinc-700';
}

function formatDateKeyInTimezone(value: Date | string, timeZone = TOKYO_TIMEZONE) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(typeof value === 'string' ? new Date(value) : value);
}

function parseDateKeyToUtcNoon(key: string) {
  const [year, month, day] = key.split('-').map((value) => Number(value));
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
}

function getWeekdayInTimezone(value: Date, timeZone = TOKYO_TIMEZONE) {
  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone }).format(value);
  return WEEKDAY_INDEX_MAP[weekday] ?? 0;
}

function heatmapLevel(count: number, maxCount: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0 || maxCount <= 0) return 0;
  const ratio = count / maxCount;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

function buildStudyHeatmap(dateKeys: string[], weeks = HEATMAP_WEEKS) {
  const todayKey = formatDateKeyInTimezone(new Date());
  const todayDate = parseDateKeyToUtcNoon(todayKey);
  const todayWeekday = getWeekdayInTimezone(todayDate);
  const currentWeekStartDate = new Date(todayDate);
  currentWeekStartDate.setUTCDate(todayDate.getUTCDate() - todayWeekday);
  const firstWeekStartDate = new Date(currentWeekStartDate);
  firstWeekStartDate.setUTCDate(currentWeekStartDate.getUTCDate() - (weeks - 1) * 7);

  const dateCountMap = new Map<string, number>();
  for (const key of dateKeys) {
    dateCountMap.set(key, (dateCountMap.get(key) ?? 0) + 1);
  }

  const allCounts = Array.from(dateCountMap.values());
  const maxCount = allCounts.length > 0 ? Math.max(...allCounts) : 0;

  const cells: StudyHeatmapCell[] = [];
  for (let column = 0; column < weeks; column += 1) {
    for (let weekday = 0; weekday < 7; weekday += 1) {
      const date = new Date(firstWeekStartDate);
      date.setUTCDate(firstWeekStartDate.getUTCDate() + column * 7 + weekday);

      const dateKey = formatDateKeyInTimezone(date);
      const isFuture = date.getTime() > todayDate.getTime();
      const count = isFuture ? 0 : (dateCountMap.get(dateKey) ?? 0);

      cells.push({
        dateKey,
        count,
        level: heatmapLevel(count, maxCount),
        column,
        weekday,
      });
    }
  }

  return { cells, maxCount, todayKey };
}

function formatHeatmapMonthLabel(dateKey: string) {
  const [, monthText] = dateKey.split('-');
  const month = Number(monthText);
  if (!Number.isFinite(month)) return '';
  return `${month}月`;
}

function formatHeatmapPeriodLabel(startDateKey: string, endDateKey: string) {
  const [startYearText, startMonthText] = startDateKey.split('-');
  const [endYearText, endMonthText] = endDateKey.split('-');
  const startYear = Number(startYearText);
  const startMonth = Number(startMonthText);
  const endYear = Number(endYearText);
  const endMonth = Number(endMonthText);
  if (!Number.isFinite(startYear) || !Number.isFinite(startMonth) || !Number.isFinite(endYear) || !Number.isFinite(endMonth)) {
    return '';
  }
  return `${startYear}年${startMonth}月〜${endYear}年${endMonth}月`;
}

function resolveSubjectInfo(
  genre: { id: string; name: string; parent_id: string | null; color_hint: string | null } | null,
  genreById: Map<string, GenreMapRow>,
) {
  if (!genre) {
    return { subjectId: null, subjectName: '教科不明' };
  }
  if (genre.parent_id == null) {
    return { subjectId: genre.id, subjectName: genre.name };
  }
  const parent = genreById.get(genre.parent_id) ?? null;
  if (!parent) {
    return { subjectId: genre.parent_id, subjectName: '教科不明' };
  }
  return { subjectId: parent.id, subjectName: parent.name };
}

export default async function HistoryPage() {
  const cookieStore = await cookies();
  const activeChildId = cookieStore.get(ACTIVE_CHILD_COOKIE)?.value ?? null;
  const { user } = await getAuthenticatedUser();

  if (!user || !activeChildId) {
    redirect('/');
  }

  const d1 = await getOptionalD1Database();
  if (!d1) {
    throw new Error('D1 binding is required');
  }

  const [child, sessionsResult, genresResult, heatmapResult] = await Promise.all([
    getD1ChildProfile(d1, user.id, activeChildId),
    d1
      .prepare(
        `
        SELECT
          ss.id,
          ss.genre_id,
          ss.total_questions,
          ss.correct_count,
          ss.earned_points,
          ss.started_at,
          ss.completed_at,
          g.name AS genre_name,
          g.parent_id AS genre_parent_id,
          g.color_hint AS genre_color_hint
        FROM study_sessions ss
        JOIN child_profiles cp ON cp.id = ss.child_id
        LEFT JOIN genres g ON g.id = ss.genre_id
        WHERE ss.child_id = ? AND cp.guardian_id = ?
        ORDER BY COALESCE(ss.completed_at, ss.started_at) DESC
        LIMIT 12
      `,
      )
      .bind(activeChildId, user.id)
      .all<D1HistorySessionRow>(),
    d1
      .prepare('SELECT id, name, parent_id, color_hint FROM genres')
      .all<GenreMapRow>(),
    d1
      .prepare(
        `
        SELECT ss.completed_at, ss.started_at
        FROM study_sessions ss
        JOIN child_profiles cp ON cp.id = ss.child_id
        WHERE ss.child_id = ? AND cp.guardian_id = ?
        ORDER BY ss.started_at DESC
        LIMIT ?
      `,
      )
      .bind(activeChildId, user.id, HEATMAP_WEEKS * 7 * 2)
      .all<StudyDayRow>(),
  ]);

  if (!child) {
    return (
      <PageShell maxWidthClass="max-w-4xl" mainClassName="flex flex-1 items-center justify-center">
        <MessageCard
          title="学習記録の読み込みに失敗しました。"
          description="時間をおいて再度お試しください。"
          actionLabel="ダッシュボードへ戻る"
          actionHref="/dashboard"
          tone="error"
        />
      </PageShell>
    );
  }

  const sessions = (sessionsResult.results ?? []).map((session) => ({
    id: session.id,
    total_questions: session.total_questions,
    correct_count: session.correct_count,
    earned_points: session.earned_points,
    started_at: session.started_at,
    completed_at: session.completed_at,
    genres: session.genre_id && session.genre_name
      ? {
          id: session.genre_id,
          name: session.genre_name,
          parent_id: session.genre_parent_id,
          color_hint: session.genre_color_hint,
        }
      : null,
  })) satisfies HistorySessionRow[];
  const heatmapRows = heatmapResult.results ?? [];
  const genreById = new Map<string, GenreMapRow>((genresResult.results ?? []).map((genre) => [genre.id, genre] as const));
  const badgeOverview = await getD1BadgeOverview(d1, { childId: activeChildId, guardianId: user.id });
  const studyDateKeys = heatmapRows.map((row) => formatDateKeyInTimezone(row.completed_at ?? row.started_at));
  const { cells: studyHeatmapCells, todayKey: heatmapTodayKey } = buildStudyHeatmap(studyDateKeys);
  const heatmapPeriodLabel =
    studyHeatmapCells.length > 0
      ? formatHeatmapPeriodLabel(studyHeatmapCells[0].dateKey, heatmapTodayKey)
      : '';
  const heatmapMonthLabels = Array.from({ length: HEATMAP_WEEKS }).map((_, weekIndex) => {
    const headerCell = studyHeatmapCells[weekIndex * 7];
    if (!headerCell) return '';

    const [currentYearText, currentMonthText] = headerCell.dateKey.split('-');
    const currentYear = Number(currentYearText);
    const currentMonth = Number(currentMonthText);

    const previousHeaderCell = weekIndex > 0 ? studyHeatmapCells[(weekIndex - 1) * 7] : null;
    if (!previousHeaderCell) {
      return formatHeatmapMonthLabel(headerCell.dateKey);
    }

    const [previousYearText, previousMonthText] = previousHeaderCell.dateKey.split('-');
    const previousYear = Number(previousYearText);
    const previousMonth = Number(previousMonthText);
    const monthChanged = previousYear !== currentYear || previousMonth !== currentMonth;
    if (!monthChanged) return '';
    return formatHeatmapMonthLabel(headerCell.dateKey);
  });

  return renderHistoryPage({
    child,
    sessions,
    genreById,
    badgeOverview,
    studyHeatmapCells,
    heatmapTodayKey,
    heatmapMonthLabels,
    heatmapPeriodLabel,
  });
}

function renderHistoryPage({
  child,
  sessions,
  genreById,
  badgeOverview,
  studyHeatmapCells,
  heatmapTodayKey,
  heatmapMonthLabels,
  heatmapPeriodLabel,
}: {
  child: { display_name: string };
  sessions: HistorySessionRow[];
  genreById: Map<string, GenreMapRow>;
  badgeOverview: BadgeOverview | null;
  studyHeatmapCells: StudyHeatmapCell[];
  heatmapTodayKey: string;
  heatmapMonthLabels: string[];
  heatmapPeriodLabel: string;
}) {
  const totalBadgeCount = badgeOverview?.unlocked_badges.length ?? 0;

  return (
    <PageShell maxWidthClass="max-w-4xl">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-1 sm:gap-8 sm:p-2">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-[2rem] border-4 border-zinc-400 bg-white p-4 shadow-brutal sm:p-6">
          <div>
            <p className="text-xs font-black text-zinc-600 sm:text-sm">学習記録</p>
            <h1 className="font-display text-[clamp(1.35rem,5.8vw,2rem)] font-black tracking-wide text-zinc-900">
              {child.display_name} さんの学習まとめ
            </h1>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border-2 border-zinc-300 bg-white px-4 py-2 text-sm font-black text-zinc-800 hover:bg-zinc-50"
          >
            <ArrowLeft className="h-4 w-4" />
            学習を開始する画面へ
          </Link>
        </header>

        {badgeOverview && (
          <section className="rounded-[2rem] border-4 border-zinc-400 bg-white p-4 shadow-brutal sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="inline-flex items-center gap-2 text-lg font-black text-zinc-900 sm:text-xl">
                <Sparkles className="h-4 w-4 text-amber-600" />
                バッジまとめ
              </h2>
              <span className="inline-flex items-center gap-1 text-sm font-black text-zinc-700 sm:text-base">
                手に入れた {totalBadgeCount}個
              </span>
              <span className="inline-flex items-center gap-1 text-sm font-black text-amber-900 sm:text-base">
                連続{badgeOverview.current_streak}日
              </span>
            </div>

            {badgeOverview.unlocked_badges.length > 0 && (
              <div className="mt-4 rounded-2xl border-2 border-zinc-300 bg-zinc-50 p-3 sm:p-4">
                <p className="text-base font-black text-zinc-900">手に入れたバッジ一覧</p>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {badgeOverview.unlocked_badges.map((badge) => (
                    <div key={`${badge.key}-${badge.unlocked_at}`} className="flex items-center gap-3 rounded-lg border-2 border-zinc-300 bg-white p-3">
                      <Image
                        src={badge.icon_path}
                        alt={badge.name}
                        width={56}
                        height={56}
                        unoptimized
                        className="h-14 w-14 rounded-lg border border-zinc-300 bg-white object-contain p-0.5"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-zinc-900">{badge.name}</p>
                        <p className="text-xs font-bold text-zinc-600">{badge.detail_text}</p>
                        <p className="text-xs font-bold text-zinc-500">{formatShortDate(badge.unlocked_at)} に手に入れた</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {badgeOverview.next_targets.length > 0 && (
              <div className="mt-4 rounded-2xl border-2 border-zinc-300 bg-zinc-50 p-3 sm:p-4">
                <p className="text-base font-black text-zinc-900">次のバッジまで</p>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {badgeOverview.next_targets.map((target) => {
                    const remaining = Math.max(0, target.threshold - target.current);
                    return (
                      <div key={target.key} className="h-full min-h-[132px] rounded-lg border-2 border-zinc-300 bg-white p-3">
                        <div className="flex h-full items-start gap-3">
                          <Image
                            src={target.icon_path}
                            alt={target.name}
                            width={56}
                            height={56}
                            unoptimized
                            className="h-14 w-14 rounded-lg border border-zinc-300 bg-white object-contain p-0.5 opacity-55 grayscale"
                          />
                          <div className="min-w-0 flex min-h-[96px] flex-1 flex-col">
                            <p className="text-xs font-bold text-zinc-500">{compactTrackLabel(target.family)}</p>
                            <p className="mt-1 line-clamp-2 min-h-[3.2rem] text-base font-black leading-tight text-zinc-900">
                              {target.name}
                            </p>
                            <p className="mt-auto text-lg font-black text-zinc-900">
                              あと{remaining}
                              {remainingUnit(target.family)}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {badgeOverview.subject_progress.length > 0 && (
              <div className="mt-4 rounded-2xl border-2 border-zinc-300 bg-zinc-50 p-3 sm:p-4">
                <p className="text-base font-black text-zinc-900">教科別の達成状況</p>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {badgeOverview.subject_progress.map((subject) => {
                    const remaining = Math.max(0, Number(subject.next_threshold ?? 0) - subject.current);
                    return (
                      <div key={subject.subject_id} className="rounded-lg border-2 border-zinc-300 bg-white px-3 py-3">
                        <div className="flex items-center gap-3">
                          {subject.next_badge_icon_path && (
                            <Image
                              src={subject.next_badge_icon_path}
                              alt={`${subject.subject_name}の次バッジ`}
                              width={48}
                              height={48}
                              unoptimized
                              className="h-12 w-12 rounded-lg border border-zinc-300 bg-white object-contain p-0.5 opacity-50 grayscale"
                            />
                          )}
                          <div className="min-w-0">
                            <p className="text-base font-black text-zinc-900">{subject.subject_name}</p>
                            <p className="mt-1 text-sm font-bold text-zinc-700">
                              {subject.next_threshold == null ? `最高ランク達成（${subject.current}回）` : `${subject.current}回学習（あと${remaining}回）`}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </section>
        )}

        <section className="rounded-[2rem] border-4 border-zinc-400 bg-white p-4 shadow-brutal sm:p-6">
          <h2 className="inline-flex items-center gap-2 text-lg font-black text-zinc-900 sm:text-xl">
            <CalendarDays className="h-4 w-4 text-blue-600" />
            最近の学習
          </h2>
          <div className="mt-4 rounded-2xl border-2 border-zinc-300 bg-zinc-50 p-3 sm:p-4">
            <StudyHeatmap cells={studyHeatmapCells} todayKey={heatmapTodayKey} monthLabels={heatmapMonthLabels} periodLabel={heatmapPeriodLabel} />
          </div>
          {sessions.length === 0 ? (
            <p className="mt-4 rounded-xl border-2 border-zinc-300 bg-zinc-50 p-4 text-sm font-bold text-zinc-700">
              まだ学習記録がありません。ダッシュボードから学習を始めましょう。
            </p>
          ) : (
            <div className="mt-3 grid grid-cols-1 gap-2">
              {sessions.map((session) => {
                const genre = Array.isArray(session.genres) ? session.genres[0] : session.genres;
                const subject = resolveSubjectInfo(genre ?? null, genreById);
                return (
                  <div key={session.id} className="flex items-center justify-between gap-3 rounded-xl border-2 border-zinc-300 bg-zinc-50 px-3 py-2">
                    <div className="min-w-0">
                      <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-black ${subjectChipClass(subject.subjectId)}`}>
                        {subject.subjectName}
                      </span>
                      <p className="truncate text-sm font-black text-zinc-900">{genre?.name ?? 'ジャンル不明'}</p>
                      <p className="text-xs font-bold text-zinc-600">{formatDateLabel(session.completed_at ?? session.started_at)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-zinc-900">
                        {session.correct_count}/{session.total_questions}問
                      </p>
                      <p className="inline-flex items-center gap-1 text-xs font-black text-amber-700">
                        <Trophy className="h-3.5 w-3.5" />
                        +{session.earned_points}pt
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </PageShell>
  );
}
