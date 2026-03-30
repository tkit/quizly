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

const IDEMPOTENCY_TTL_SECONDS = 60 * 60;

type HistoryRecord = {
  question_id: string;
  is_correct: boolean;
  selected_index: number;
};

type PointTransaction = {
  points: number;
  reason: string;
};

export type UnlockedBadge = {
  key: string;
  name: string;
  icon_path: string;
  is_secret: boolean;
};

type Body = {
  idempotencyKey?: string;
  genreId?: string;
  mode?: string;
  totalQuestions?: number;
  correctCount?: number;
  earnedPoints?: number;
  completedAt?: string;
  historyRecords?: HistoryRecord[];
  pointTransactions?: PointTransaction[];
};

type IdempotencyState =
  | { status: 'pending'; createdAt: string }
  | { status: 'done'; sessionId: string; unlockedBadges: UnlockedBadge[]; createdAt: string };

type CompleteStudySessionResult = {
  sessionId: string;
  unlockedBadges?: UnlockedBadge[];
};

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

  if (!body.genreId || !body.completedAt || !Array.isArray(body.historyRecords) || !Array.isArray(body.pointTransactions)) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
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
          deduplicated: true,
        });
      }

      return NextResponse.json({ error: 'A duplicated completion request is in progress' }, { status: 409 });
    }
  }

  const mode = body.mode ?? 'normal';
  const totalQuestions = Number(body.totalQuestions ?? 0);
  const correctCount = Number(body.correctCount ?? 0);
  const earnedPoints = Number(body.earnedPoints ?? 0);

  const { data: completionResult, error: completionError } = await supabase.rpc('complete_study_session', {
    p_child_id: activeChildId,
    p_genre_id: body.genreId,
    p_mode: mode,
    p_total_questions: totalQuestions,
    p_correct_count: correctCount,
    p_earned_points: earnedPoints,
    p_completed_at: body.completedAt,
    p_history_records: body.historyRecords,
    p_point_transactions: body.pointTransactions,
  });

  const completionData = (completionResult ?? null) as CompleteStudySessionResult | null;
  const sessionId = completionData?.sessionId ?? null;
  const unlockedBadges = Array.isArray(completionData?.unlockedBadges) ? completionData.unlockedBadges : [];

  if (completionError || !sessionId) {
    if (isUpstashConfigured()) {
      await deleteRedisKey(cacheKey).catch(() => null);
    }

    return NextResponse.json({ error: completionError?.message ?? 'Failed to complete study session' }, { status: 500 });
  }

  if (isUpstashConfigured()) {
    await setRedisString(
      cacheKey,
      JSON.stringify({
        status: 'done',
        sessionId,
        unlockedBadges,
        createdAt: new Date().toISOString(),
      } satisfies IdempotencyState),
      IDEMPOTENCY_TTL_SECONDS,
    ).catch(() => null);
  }

  await invalidateBadgeOverviewCache(activeChildId);

  return NextResponse.json({ sessionId, unlockedBadges, deduplicated: false });
}
