import { NextRequest, NextResponse } from 'next/server';
import { ACTIVE_CHILD_COOKIE } from '@/lib/auth/constants';
import { getAuthenticatedUser } from '@/lib/auth/server';
import { getOptionalD1Database } from '@/lib/cloudflare/d1';
import {
  calculateSessionPoints,
  CONSECUTIVE_CORRECT_STREAK_BONUS_POINTS,
  CONSECUTIVE_CORRECT_STREAK_THRESHOLD,
  DAILY_CHALLENGE_BONUS_POINTS,
} from '@/lib/points';
import { completeStudySessionInD1, type UnlockedBadge } from '@/lib/study/completeSession';

const IDEMPOTENCY_TTL_SECONDS = 60 * 60;
const IDEMPOTENCY_LOCK_SECONDS = 60;
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

type CompletionResponseBody = {
  sessionId: string;
  unlockedBadges: UnlockedBadge[];
  pointCapped: boolean;
  deduplicated: boolean;
};

type D1IdempotencyRow = {
  status: 'in_progress' | 'completed';
  response_json: string | null;
  locked_until: string;
  expires_at: string;
};

function buildIdempotencyKey(guardianId: string, childId: string, idempotencyKey: string) {
  return `quizly:study_session_complete:idempotency:v1:${guardianId}:${childId}:${idempotencyKey}`;
}

function isValidIdempotencyKey(value: string) {
  return /^[a-zA-Z0-9_-]{8,128}$/.test(value);
}

function formatJstDate(value: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
}

function getD1ChangedRows(result: D1Result<unknown>) {
  if (!result.meta || typeof result.meta !== 'object' || !('changes' in result.meta)) {
    return 0;
  }

  const changes = result.meta.changes;
  return typeof changes === 'number' ? changes : 0;
}

function parseCompletionResponse(raw: string | null): CompletionResponseBody | null {
  if (!raw) return null;

  try {
    return JSON.parse(raw) as CompletionResponseBody;
  } catch {
    return null;
  }
}

async function acquireD1CompletionIdempotencyLock(
  db: D1Database,
  params: {
    key: string;
    guardianId: string;
    childId: string;
  },
) {
  const now = new Date();
  const nowIso = now.toISOString();
  const lockedUntil = new Date(now.getTime() + IDEMPOTENCY_LOCK_SECONDS * 1000).toISOString();
  const expiresAt = new Date(now.getTime() + IDEMPOTENCY_TTL_SECONDS * 1000).toISOString();

  await db
    .prepare('DELETE FROM study_completion_idempotency WHERE key = ? AND expires_at <= ?')
    .bind(params.key, nowIso)
    .run();

  const insertResult = await db
    .prepare(
      `
      INSERT OR IGNORE INTO study_completion_idempotency (
        key, guardian_id, child_id, status, locked_until, expires_at, created_at, updated_at
      ) VALUES (?, ?, ?, 'in_progress', ?, ?, ?, ?)
    `,
    )
    .bind(params.key, params.guardianId, params.childId, lockedUntil, expiresAt, nowIso, nowIso)
    .run();

  if (getD1ChangedRows(insertResult) > 0) {
    return { acquired: true as const };
  }

  const existing = await db
    .prepare(
      `
      SELECT status, response_json, locked_until, expires_at
      FROM study_completion_idempotency
      WHERE key = ? AND guardian_id = ? AND child_id = ?
      LIMIT 1
    `,
    )
    .bind(params.key, params.guardianId, params.childId)
    .first<D1IdempotencyRow>();

  if (!existing) {
    return { acquired: false as const, conflict: true as const };
  }

  if (existing.status === 'completed') {
    const response = parseCompletionResponse(existing.response_json);
    if (response) {
      return { acquired: false as const, response: { ...response, deduplicated: true } };
    }
  }

  if (new Date(existing.locked_until).getTime() > now.getTime()) {
    return { acquired: false as const, conflict: true as const };
  }

  const updateResult = await db
    .prepare(
      `
      UPDATE study_completion_idempotency
      SET status = 'in_progress',
          response_json = NULL,
          session_id = NULL,
          locked_until = ?,
          expires_at = ?,
          updated_at = ?
      WHERE key = ?
        AND guardian_id = ?
        AND child_id = ?
        AND status = 'in_progress'
        AND locked_until <= ?
    `,
    )
    .bind(lockedUntil, expiresAt, nowIso, params.key, params.guardianId, params.childId, nowIso)
    .run();

  return { acquired: getD1ChangedRows(updateResult) > 0 };
}

async function markD1CompletionIdempotencyDone(
  db: D1Database,
  key: string,
  response: CompletionResponseBody,
) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + IDEMPOTENCY_TTL_SECONDS * 1000).toISOString();

  await db
    .prepare(
      `
      UPDATE study_completion_idempotency
      SET status = 'completed',
          session_id = ?,
          response_json = ?,
          expires_at = ?,
          updated_at = ?
      WHERE key = ?
    `,
    )
    .bind(response.sessionId, JSON.stringify(response), expiresAt, now.toISOString(), key)
    .run();
}

async function clearD1CompletionIdempotencyLock(db: D1Database, key: string) {
  await db.prepare('DELETE FROM study_completion_idempotency WHERE key = ?').bind(key).run();
}

async function restoreD1DailyPointState(
  db: D1Database,
  childId: string,
  previousState: ChildDailyPointState | null,
) {
  if (!previousState) {
    await db.prepare('DELETE FROM child_daily_point_state WHERE child_id = ?').bind(childId).run();
    return;
  }

  await db
    .prepare(
      `
      INSERT INTO child_daily_point_state (
        child_id, state_date, consecutive_correct_count, streak_bonus_count,
        daily_challenge_awarded, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(child_id) DO UPDATE SET
        state_date = excluded.state_date,
        consecutive_correct_count = excluded.consecutive_correct_count,
        streak_bonus_count = excluded.streak_bonus_count,
        daily_challenge_awarded = excluded.daily_challenge_awarded,
        updated_at = excluded.updated_at
    `,
    )
    .bind(
      childId,
      previousState.state_date,
      previousState.consecutive_correct_count,
      previousState.streak_bonus_count,
      previousState.daily_challenge_awarded ? 1 : 0,
      new Date().toISOString(),
    )
    .run();
}

async function completeWithD1(
  db: D1Database,
  params: {
    guardianId: string;
    activeChildId: string;
    body: Body;
    completedAt: Date;
    cacheKey: string;
  },
) {
  const { guardianId, activeChildId, body, completedAt, cacheKey } = params;
  const child = await db
    .prepare('SELECT id FROM child_profiles WHERE id = ? AND guardian_id = ? LIMIT 1')
    .bind(activeChildId, guardianId)
    .first<{ id: string }>();

  if (!child) {
    return NextResponse.json({ error: 'Child not found' }, { status: 404 });
  }

  const lock = await acquireD1CompletionIdempotencyLock(db, {
    key: cacheKey,
    guardianId,
    childId: activeChildId,
  });

  if (!lock.acquired) {
    if ('response' in lock && lock.response) {
      return NextResponse.json(lock.response);
    }

    return NextResponse.json({ error: 'A duplicated completion request is in progress' }, { status: 409 });
  }

  const mode = body.mode ?? 'normal';
  const totalQuestions = Number(body.totalQuestions ?? 0);
  const correctCount = Number(body.correctCount ?? 0);
  const pointsResult = calculateSessionPoints(correctCount, totalQuestions);
  const completedDateJst = formatJstDate(completedAt);

  const genreAttemptRow = await db
    .prepare('SELECT COUNT(*) AS count FROM study_sessions WHERE child_id = ? AND genre_id = ?')
    .bind(activeChildId, body.genreId)
    .first<{ count: number }>();
  const pointCapped = Number(genreAttemptRow?.count ?? 0) >= MAX_POINT_ELIGIBLE_ATTEMPTS_PER_GENRE;
  let previousDailyState: ChildDailyPointState | null = null;
  let earnedPoints = 0;
  let pointTransactions: PointTransaction[] = [];
  let shouldRestoreDailyPointState = false;

  if (!pointCapped) {
    const existingDailyStateRaw = await db
      .prepare(
        `
        SELECT state_date, consecutive_correct_count, streak_bonus_count, daily_challenge_awarded
        FROM child_daily_point_state
        WHERE child_id = ?
        LIMIT 1
      `,
      )
      .bind(activeChildId)
      .first<ChildDailyPointState & { daily_challenge_awarded: number | boolean }>();

    const existingDailyState = existingDailyStateRaw
      ? {
          ...existingDailyStateRaw,
          daily_challenge_awarded: Boolean(existingDailyStateRaw.daily_challenge_awarded),
        }
      : null;
    previousDailyState = existingDailyState ? { ...existingDailyState } : null;

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

    for (const record of body.historyRecords ?? []) {
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

    await db
      .prepare(
        `
        INSERT INTO child_daily_point_state (
          child_id, state_date, consecutive_correct_count, streak_bonus_count,
          daily_challenge_awarded, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(child_id) DO UPDATE SET
          state_date = excluded.state_date,
          consecutive_correct_count = excluded.consecutive_correct_count,
          streak_bonus_count = excluded.streak_bonus_count,
          daily_challenge_awarded = excluded.daily_challenge_awarded,
          updated_at = excluded.updated_at
      `,
      )
      .bind(
        activeChildId,
        dailyState.state_date,
        dailyState.consecutive_correct_count,
        dailyState.streak_bonus_count,
        dailyState.daily_challenge_awarded ? 1 : 0,
        new Date().toISOString(),
      )
      .run();

    shouldRestoreDailyPointState = true;
  }

  const completionResult = await completeStudySessionInD1(db, {
    childId: activeChildId,
    genreId: body.genreId ?? '',
    mode,
    totalQuestions,
    correctCount,
    earnedPoints,
    completedAt: body.completedAt ?? new Date().toISOString(),
    completedDateJst,
    historyRecords: body.historyRecords ?? [],
    pointTransactions,
  }).catch((error: unknown) => ({ error }));

  if ('error' in completionResult) {
    console.error('[study-session-complete] d1 completion failed', {
      guardianId,
      activeChildId,
      genreId: body.genreId,
      totalQuestions,
      correctCount,
      historyRecordCount: body.historyRecords?.length ?? 0,
      error: completionResult.error,
    });

    if (shouldRestoreDailyPointState) {
      await restoreD1DailyPointState(db, activeChildId, previousDailyState).catch(() => null);
    }
    await clearD1CompletionIdempotencyLock(db, cacheKey).catch(() => null);

    const message = completionResult.error instanceof Error ? completionResult.error.message : 'Failed to complete study session';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const { sessionId, unlockedBadges } = completionResult;
  const responseBody = { sessionId, unlockedBadges, pointCapped, deduplicated: false } satisfies CompletionResponseBody;
  await markD1CompletionIdempotencyDone(db, cacheKey, responseBody).catch((error) => {
    console.warn('[study-session-complete] failed to mark d1 idempotency key completed', error);
  });

  console.info(`[study-session-complete] completed via d1 guardian=${guardianId}`);
  return NextResponse.json(responseBody);
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

  const cacheKey = buildIdempotencyKey(user.id, activeChildId, idempotencyKey);
  const d1 = await getOptionalD1Database();
  if (!d1) {
    return NextResponse.json({ error: 'D1 binding is required' }, { status: 500 });
  }

  return completeWithD1(d1, {
    guardianId: user.id,
    activeChildId,
    body,
    completedAt,
    cacheKey,
  });
}
