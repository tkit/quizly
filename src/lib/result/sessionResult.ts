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
    name: string;
    icon_key: string;
    color_hint: string;
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
