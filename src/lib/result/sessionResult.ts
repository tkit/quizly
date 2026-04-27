import type { SupabaseClient } from '@supabase/supabase-js';
import { getRedisString, isUpstashConfigured, setRedisString } from '@/lib/cache/upstash';

const RESULT_SESSION_CACHE_TTL_SECONDS = 5 * 60;

export type ResultQuestionDetails = {
  question_text: string;
  options: string[];
  correct_index: number;
  explanation: string | null;
};

export type ResultHistoryItem = {
  is_correct: boolean;
  selected_index: number;
  questions: ResultQuestionDetails | ResultQuestionDetails[] | null;
};

export type ResultSession = {
  id: string;
  genre_id: string;
  total_questions: number;
  correct_count: number;
  earned_points: number;
  mode: string;
  genres: {
    id: string;
    parent_id: string | null;
    name: string;
    icon_key: string;
    color_hint: string | null;
  } | null;
};

export type ResultUnlockedBadge = {
  key: string;
  name: string;
  icon_path: string;
  is_secret: boolean;
  condition_text: string;
};

export type ResultSessionSnapshot = {
  session: ResultSession;
  history: ResultHistoryItem[];
  unlockedBadges: ResultUnlockedBadge[];
};

function buildResultSessionCacheKey(guardianId: string, sessionId: string) {
  return `quizly:result_session:v2:${guardianId}:${sessionId}`;
}

type BadgeCondition = {
  threshold?: number;
  subject_id?: string;
  type?: string;
};

type BadgeDefinitionRow = {
  key: string;
  family: string;
  level: number | null;
  name: string;
  icon_path: string;
  is_secret: boolean;
  condition_json: BadgeCondition | null;
};

type D1ResultSessionRow = Omit<ResultSession, 'genres'> & {
  genre_name: string | null;
  genre_parent_id: string | null;
  genre_icon_key: string | null;
  genre_color_hint: string | null;
};

type D1HistoryRow = {
  is_correct: number | boolean;
  selected_index: number;
  question_text: string;
  options: string;
  correct_index: number;
  explanation: string | null;
};

type D1BadgeDefinitionRow = Omit<BadgeDefinitionRow, 'is_secret' | 'condition_json'> & {
  is_secret: number | boolean;
  condition_json: string | BadgeCondition | null;
};

function resolveSubjectName(subjectId: string | undefined) {
  switch (subjectId) {
    case 'japanese':
      return '国語';
    case 'math':
      return '算数';
    case 'science':
      return '理科';
    case 'social':
      return '社会';
    default:
      return '対象教科';
  }
}

function buildBadgeConditionText(definition: BadgeDefinitionRow) {
  const condition = definition.condition_json ?? {};
  const threshold = Number(condition.threshold ?? 0);

  if (definition.is_secret) {
    if (condition.type === 'comeback') {
      return '3日以上あいてから学習を再開';
    }
    if (condition.type === 'perfect_recovery') {
      return '前回不正解を含んだ後に全問正解';
    }
    return '特別な条件を達成';
  }

  if (definition.family === 'streak_days') {
    return `連続${threshold}日学習を達成`;
  }
  if (definition.family === 'perfect_sessions') {
    return `全問正解を累計${threshold}回達成`;
  }
  if (definition.family === 'genre_explorer') {
    return `異なるジャンルを累計${threshold}種類達成`;
  }
  if (definition.family === 'total_points') {
    return `累計${threshold}pt達成`;
  }
  if (definition.family === 'subject_master') {
    const subjectName = resolveSubjectName(condition.subject_id);
    return `${subjectName}の学習を累計${threshold}回達成`;
  }

  return '達成条件をクリア';
}

async function loadResultSessionSnapshotFromDatabase(supabase: SupabaseClient, sessionId: string): Promise<ResultSessionSnapshot> {
  const [{ data: sessionData, error: sessionError }, { data: historyData, error: historyError }, { data: unlockEventsData, error: unlockEventsError }] = await Promise.all([
    supabase
      .from('study_sessions')
      .select(
        `
        *,
        genres (
          id,
          parent_id,
          name,
          icon_key,
          color_hint
        )
      `,
      )
      .eq('id', sessionId)
      .single(),
    supabase
      .from('study_history')
      .select(
        `
        is_correct,
        selected_index,
        questions (
          question_text,
          options,
          correct_index,
          explanation
        )
      `,
      )
      .eq('session_id', sessionId)
      .order('answered_at', { ascending: true }),
    supabase
      .from('badge_unlock_events')
      .select('badge_key, created_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true }),
  ]);

  if (sessionError || !sessionData || historyError || unlockEventsError) {
    throw sessionError ?? historyError ?? unlockEventsError ?? new Error('Failed to load result session');
  }

  const unlockEvents = (unlockEventsData ?? []) as Array<{ badge_key: string; created_at: string }>;
  const badgeKeys = [...new Set(unlockEvents.map((row) => row.badge_key).filter((key): key is string => Boolean(key)))];

  let unlockedBadges: ResultUnlockedBadge[] = [];
  if (badgeKeys.length > 0) {
    const { data: badgeDefinitionsData, error: badgeDefinitionsError } = await supabase
      .from('badge_definitions')
      .select('key, family, level, name, icon_path, is_secret, condition_json')
      .in('key', badgeKeys);

    if (badgeDefinitionsError) {
      throw badgeDefinitionsError;
    }

    const badgeDefinitions = (badgeDefinitionsData ?? []) as BadgeDefinitionRow[];
    const badgeMap = new Map(
      badgeDefinitions.map((badge) => [
        badge.key,
        {
          key: badge.key,
          name: badge.name,
          icon_path: badge.icon_path,
          is_secret: badge.is_secret,
          condition_text: buildBadgeConditionText(badge),
        } satisfies ResultUnlockedBadge,
      ] as const),
    );

    unlockedBadges = unlockEvents
      .map((row) => badgeMap.get(row.badge_key))
      .filter((badge): badge is ResultUnlockedBadge => Boolean(badge));
  }

  return {
    session: sessionData as ResultSession,
    history: (historyData ?? []) as ResultHistoryItem[],
    unlockedBadges,
  };
}

function normalizeD1BadgeDefinition(row: D1BadgeDefinitionRow): BadgeDefinitionRow {
  let conditionJson: BadgeCondition | null = null;

  if (typeof row.condition_json === 'string' && row.condition_json.length > 0) {
    conditionJson = JSON.parse(row.condition_json) as BadgeCondition;
  } else if (row.condition_json && typeof row.condition_json === 'object') {
    conditionJson = row.condition_json;
  }

  return {
    ...row,
    is_secret: Boolean(row.is_secret),
    condition_json: conditionJson,
  };
}

export async function getD1ResultSessionSnapshot(
  db: D1Database,
  params: { guardianId: string; sessionId: string },
): Promise<ResultSessionSnapshot> {
  const { guardianId, sessionId } = params;
  const [sessionRow, historyResult, unlockEventsResult] = await Promise.all([
    db
      .prepare(
        `
        SELECT
          ss.id,
          ss.genre_id,
          ss.total_questions,
          ss.correct_count,
          ss.earned_points,
          ss.mode,
          g.name AS genre_name,
          g.parent_id AS genre_parent_id,
          g.icon_key AS genre_icon_key,
          g.color_hint AS genre_color_hint
        FROM study_sessions ss
        JOIN child_profiles cp ON cp.id = ss.child_id
        LEFT JOIN genres g ON g.id = ss.genre_id
        WHERE ss.id = ? AND cp.guardian_id = ?
        LIMIT 1
      `,
      )
      .bind(sessionId, guardianId)
      .first<D1ResultSessionRow>(),
    db
      .prepare(
        `
        SELECT
          sh.is_correct,
          sh.selected_index,
          q.question_text,
          q.options,
          q.correct_index,
          q.explanation
        FROM study_history sh
        JOIN study_sessions ss ON ss.id = sh.session_id
        JOIN child_profiles cp ON cp.id = ss.child_id
        JOIN questions q ON q.id = sh.question_id
        WHERE sh.session_id = ? AND cp.guardian_id = ?
        ORDER BY sh.answered_at ASC
      `,
      )
      .bind(sessionId, guardianId)
      .all<D1HistoryRow>(),
    db
      .prepare(
        `
        SELECT bue.badge_key, bue.created_at
        FROM badge_unlock_events bue
        JOIN study_sessions ss ON ss.id = bue.session_id
        JOIN child_profiles cp ON cp.id = ss.child_id
        WHERE bue.session_id = ? AND cp.guardian_id = ?
        ORDER BY bue.created_at ASC
      `,
      )
      .bind(sessionId, guardianId)
      .all<{ badge_key: string; created_at: string }>(),
  ]);

  if (!sessionRow) {
    throw new Error('Result session not found');
  }

  const unlockEvents = unlockEventsResult.results ?? [];
  const badgeKeys = [...new Set(unlockEvents.map((row) => row.badge_key).filter((key): key is string => Boolean(key)))];
  let unlockedBadges: ResultUnlockedBadge[] = [];

  if (badgeKeys.length > 0) {
    const placeholders = badgeKeys.map(() => '?').join(', ');
    const badgeDefinitionsResult = await db
      .prepare(
        `
        SELECT key, family, level, name, icon_path, is_secret, condition_json
        FROM badge_definitions
        WHERE key IN (${placeholders})
      `,
      )
      .bind(...badgeKeys)
      .all<D1BadgeDefinitionRow>();

    const badgeMap = new Map(
      (badgeDefinitionsResult.results ?? []).map((row) => {
        const badge = normalizeD1BadgeDefinition(row);
        return [
          badge.key,
          {
            key: badge.key,
            name: badge.name,
            icon_path: badge.icon_path,
            is_secret: badge.is_secret,
            condition_text: buildBadgeConditionText(badge),
          } satisfies ResultUnlockedBadge,
        ] as const;
      }),
    );

    unlockedBadges = unlockEvents
      .map((row) => badgeMap.get(row.badge_key))
      .filter((badge): badge is ResultUnlockedBadge => Boolean(badge));
  }

  return {
    session: {
      id: sessionRow.id,
      genre_id: sessionRow.genre_id,
      total_questions: sessionRow.total_questions,
      correct_count: sessionRow.correct_count,
      earned_points: sessionRow.earned_points,
      mode: sessionRow.mode,
      genres: sessionRow.genre_name
        ? {
            id: sessionRow.genre_id,
            parent_id: sessionRow.genre_parent_id,
            name: sessionRow.genre_name,
            icon_key: sessionRow.genre_icon_key ?? 'notebook',
            color_hint: sessionRow.genre_color_hint,
          }
        : null,
    },
    history: (historyResult.results ?? []).map((row) => ({
      is_correct: Boolean(row.is_correct),
      selected_index: row.selected_index,
      questions: {
        question_text: row.question_text,
        options: JSON.parse(row.options) as string[],
        correct_index: row.correct_index,
        explanation: row.explanation,
      },
    })),
    unlockedBadges,
  };
}

export async function getResultSessionSnapshot(
  supabase: SupabaseClient,
  params: { guardianId: string; sessionId: string },
): Promise<ResultSessionSnapshot> {
  const startedAt = Date.now();
  const { guardianId, sessionId } = params;
  const cacheKey = buildResultSessionCacheKey(guardianId, sessionId);

  if (isUpstashConfigured()) {
    try {
      const cached = await getRedisString(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as ResultSessionSnapshot;
        console.info(`[result-session-cache] hit session=${sessionId} elapsed_ms=${Date.now() - startedAt}`);
        return parsed;
      }
      console.info(`[result-session-cache] miss session=${sessionId}`);
    } catch (error) {
      console.warn(`[result-session-cache] failed to read session=${sessionId}`, error);
    }
  }

  const snapshot = await loadResultSessionSnapshotFromDatabase(supabase, sessionId);
  console.info(`[result-session-cache] rebuilt session=${sessionId} elapsed_ms=${Date.now() - startedAt}`);

  if (isUpstashConfigured()) {
    try {
      await setRedisString(cacheKey, JSON.stringify(snapshot), RESULT_SESSION_CACHE_TTL_SECONDS);
    } catch (error) {
      console.warn(`[result-session-cache] failed to write session=${sessionId}`, error);
    }
  }

  return snapshot;
}
