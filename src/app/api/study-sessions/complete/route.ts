import { NextRequest, NextResponse } from 'next/server';
import { ACTIVE_CHILD_COOKIE } from '@/lib/auth/constants';
import { createServerSupabaseClient, getAuthenticatedUser } from '@/lib/auth/server';
import {
  deleteRedisKey,
  getRedisString,
  isUpstashConfigured,
  setRedisString,
  setRedisStringIfNotExists,
} from '@/lib/cache/upstash';
import { invalidateBadgeOverviewCache } from '@/lib/badges/overview';
import {
  calculateSessionPoints,
  CONSECUTIVE_CORRECT_STREAK_BONUS_POINTS,
  CONSECUTIVE_CORRECT_STREAK_THRESHOLD,
  DAILY_CHALLENGE_BONUS_POINTS,
} from '@/lib/points';
import { completeStudySessionInAppLayer, type UnlockedBadge } from '@/lib/study/completeSession';

const IDEMPOTENCY_TTL_SECONDS = 60 * 60;
const MAX_POINT_ELIGIBLE_ATTEMPTS_PER_GENRE = 5;

type HistoryRecord = {
  question_id: string;
  is_correct: boolean;
  selected_index: number;
};

type PointTransaction = {
  points: number;
  reason: 'correct_answer' | 'perfect_bonus' | 'daily_challenge_bonus' | 'correct_streak_bonus';
};

type Body = {
  idempotencyKey?: string;
  genreId?: string;
  mode?: string;
  totalQuestions?: number;
  correctCount?: number;
  completedAt?: string;
  historyRecords?: HistoryRecord[];
};

type ChildDailyPointState = {
  state_date: string;
  consecutive_correct_count: number;
  streak_bonus_count: number;
  daily_challenge_awarded: boolean;
};

type IdempotencyState =
  | { status: 'pending'; createdAt: string }
  | { status: 'done'; sessionId: string; unlockedBadges: UnlockedBadge[]; pointCapped: boolean; createdAt: string };

function buildIdempotencyKey(guardianId: string, childId: string, idempotencyKey: string) {
  return `quizly:study_session_complete:idempotency:v1:${guardianId}:${childId}:${idempotencyKey}`;
}

function isValidIdempotencyKey(value: string) {
  return /^[a-zA-Z0-9_-]{8,128}$/.test(value);
}

function parseIdempotencyState(raw: string | null): IdempotencyState | null {
  if (!raw) return null;

  try {
    return JSON.parse(raw) as IdempotencyState;
  } catch {
    return null;
  }
}

function formatJstDate(value: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
}

async function restoreDailyPointState(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  childId: string,
  previousState: ChildDailyPointState | null,
) {
  if (!previousState) {
    await supabase
      .from('child_daily_point_state')
      .delete()
      .eq('child_id', childId);
    return;
  }

  await supabase
    .from('child_daily_point_state')
    .upsert({
      child_id: childId,
      state_date: previousState.state_date,
      consecutive_correct_count: previousState.consecutive_correct_count,
      streak_bonus_count: previousState.streak_bonus_count,
      daily_challenge_awarded: previousState.daily_challenge_awarded,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'child_id' });
}

export async function POST(request: NextRequest) {
  const { user } = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const activeChildId = request.cookies.get(ACTIVE_CHILD_COOKIE)?.value;
  if (!activeChildId) {
    return NextResponse.json({ error: 'Active child is required' }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const idempotencyKey = (body.idempotencyKey ?? '').trim();
  if (!isValidIdempotencyKey(idempotencyKey)) {
    return NextResponse.json({ error: 'Invalid idempotency key' }, { status: 400 });
  }

  if (!body.genreId || !body.completedAt || !Array.isArray(body.historyRecords)) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const completedAt = new Date(body.completedAt);
  if (Number.isNaN(completedAt.getTime())) {
    return NextResponse.json({ error: 'Invalid completedAt' }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const { data: child, error: childError } = await supabase
    .from('child_profiles')
    .select('id')
    .eq('id', activeChildId)
    .single();

  if (childError || !child) {
    return NextResponse.json({ error: 'Child not found' }, { status: 404 });
  }

  const cacheKey = buildIdempotencyKey(user.id, activeChildId, idempotencyKey);

  if (isUpstashConfigured()) {
    const existingRaw = await getRedisString(cacheKey).catch(() => null);
    const existing = parseIdempotencyState(existingRaw);

    if (existing?.status === 'done') {
      return NextResponse.json({
        sessionId: existing.sessionId,
        unlockedBadges: existing.unlockedBadges ?? [],
        pointCapped: existing.pointCapped ?? false,
        deduplicated: true,
      });
    }

    const acquired = await setRedisStringIfNotExists(
      cacheKey,
      JSON.stringify({ status: 'pending', createdAt: new Date().toISOString() } satisfies IdempotencyState),
      IDEMPOTENCY_TTL_SECONDS,
    ).catch(() => false);

    if (!acquired) {
      const nowRaw = await getRedisString(cacheKey).catch(() => null);
      const nowState = parseIdempotencyState(nowRaw);

      if (nowState?.status === 'done') {
        return NextResponse.json({
          sessionId: nowState.sessionId,
          unlockedBadges: nowState.unlockedBadges ?? [],
          pointCapped: nowState.pointCapped ?? false,
          deduplicated: true,
        });
      }

      return NextResponse.json({ error: 'A duplicated completion request is in progress' }, { status: 409 });
    }
  }

  const mode = body.mode ?? 'normal';
  const totalQuestions = Number(body.totalQuestions ?? 0);
  const correctCount = Number(body.correctCount ?? 0);
  const pointsResult = calculateSessionPoints(correctCount, totalQuestions);
  const completedDateJst = formatJstDate(completedAt);

  const { count: genreAttemptCount, error: genreAttemptCountError } = await supabase
    .from('study_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('child_id', activeChildId)
    .eq('genre_id', body.genreId);

  if (genreAttemptCountError) {
    if (isUpstashConfigured()) {
      await deleteRedisKey(cacheKey).catch(() => null);
    }
    return NextResponse.json({ error: 'Failed to read genre attempt count' }, { status: 500 });
  }

  const pointCapped = (genreAttemptCount ?? 0) >= MAX_POINT_ELIGIBLE_ATTEMPTS_PER_GENRE;
  let previousDailyState: ChildDailyPointState | null = null;
  let earnedPoints = 0;
  let pointTransactions: PointTransaction[] = [];
  let shouldRestoreDailyPointState = false;

  if (!pointCapped) {
    const { data: existingDailyStateRaw, error: dailyStateError } = await supabase
      .from('child_daily_point_state')
      .select('state_date, consecutive_correct_count, streak_bonus_count, daily_challenge_awarded')
      .eq('child_id', activeChildId)
      .maybeSingle();

    if (dailyStateError) {
      if (isUpstashConfigured()) {
        await deleteRedisKey(cacheKey).catch(() => null);
      }
      return NextResponse.json({ error: 'Failed to read daily point state' }, { status: 500 });
    }

    const existingDailyState = (existingDailyStateRaw ?? null) as ChildDailyPointState | null;
    previousDailyState = existingDailyState
      ? {
          ...existingDailyState,
        }
      : null;

    let dailyState: ChildDailyPointState = {
      state_date: completedDateJst,
      consecutive_correct_count: 0,
      streak_bonus_count: 0,
      daily_challenge_awarded: false,
    };

    if (existingDailyState && existingDailyState.state_date === completedDateJst) {
      dailyState = existingDailyState;
    }

    const dailyChallengeBonusPoints = dailyState.daily_challenge_awarded ? 0 : DAILY_CHALLENGE_BONUS_POINTS;
    dailyState.daily_challenge_awarded = true;

    const previousStreakBonusCount = dailyState.streak_bonus_count;
    let runningConsecutiveCorrect = dailyState.consecutive_correct_count;
    let streakBonusCount = dailyState.streak_bonus_count;

    for (const record of body.historyRecords) {
      if (record.is_correct) {
        runningConsecutiveCorrect += 1;
        const reachedThresholdCount = Math.floor(runningConsecutiveCorrect / CONSECUTIVE_CORRECT_STREAK_THRESHOLD);
        if (reachedThresholdCount > streakBonusCount) {
          streakBonusCount = reachedThresholdCount;
        }
        continue;
      }

      runningConsecutiveCorrect = 0;
    }

    dailyState.consecutive_correct_count = runningConsecutiveCorrect;
    dailyState.streak_bonus_count = streakBonusCount;

    const newStreakBonusCount = Math.max(0, streakBonusCount - previousStreakBonusCount);
    const streakBonusPoints = newStreakBonusCount * CONSECUTIVE_CORRECT_STREAK_BONUS_POINTS;
    earnedPoints = pointsResult.totalPoints + dailyChallengeBonusPoints + streakBonusPoints;

    pointTransactions = [
      pointsResult.basePoints > 0
        ? {
            points: pointsResult.basePoints,
            reason: 'correct_answer',
          }
        : null,
      pointsResult.bonusPoints > 0
        ? {
            points: pointsResult.bonusPoints,
            reason: 'perfect_bonus',
          }
        : null,
      dailyChallengeBonusPoints > 0
        ? {
            points: dailyChallengeBonusPoints,
            reason: 'daily_challenge_bonus',
          }
        : null,
      streakBonusPoints > 0
        ? {
            points: streakBonusPoints,
            reason: 'correct_streak_bonus',
          }
        : null,
    ].filter((transaction): transaction is PointTransaction => transaction !== null);

    const { error: upsertDailyStateError } = await supabase
      .from('child_daily_point_state')
      .upsert({
        child_id: activeChildId,
        state_date: dailyState.state_date,
        consecutive_correct_count: dailyState.consecutive_correct_count,
        streak_bonus_count: dailyState.streak_bonus_count,
        daily_challenge_awarded: dailyState.daily_challenge_awarded,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'child_id' });

    if (upsertDailyStateError) {
      if (isUpstashConfigured()) {
        await deleteRedisKey(cacheKey).catch(() => null);
      }
      return NextResponse.json({ error: 'Failed to update daily point state' }, { status: 500 });
    }

    shouldRestoreDailyPointState = true;
  }

  const completionResult = await completeStudySessionInAppLayer(supabase, {
    childId: activeChildId,
    genreId: body.genreId,
    mode,
    totalQuestions,
    correctCount,
    earnedPoints,
    completedAt: body.completedAt,
    completedDateJst,
    historyRecords: body.historyRecords,
    pointTransactions,
  }).catch((error: unknown) => ({ error }));

  if ('error' in completionResult) {
    if (shouldRestoreDailyPointState) {
      await restoreDailyPointState(supabase, activeChildId, previousDailyState).catch(() => null);
    }

    if (isUpstashConfigured()) {
      await deleteRedisKey(cacheKey).catch(() => null);
    }

    const message = completionResult.error instanceof Error ? completionResult.error.message : 'Failed to complete study session';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const { sessionId, unlockedBadges } = completionResult;

  if (isUpstashConfigured()) {
    await setRedisString(
      cacheKey,
      JSON.stringify({
        status: 'done',
        sessionId,
        unlockedBadges,
        pointCapped,
        createdAt: new Date().toISOString(),
      } satisfies IdempotencyState),
      IDEMPOTENCY_TTL_SECONDS,
    ).catch(() => null);
  }

  await invalidateBadgeOverviewCache(activeChildId);

  return NextResponse.json({ sessionId, unlockedBadges, pointCapped, deduplicated: false });
}
