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

export type ResultSessionSnapshot = {
  session: ResultSession;
  history: ResultHistoryItem[];
};

function buildResultSessionCacheKey(guardianId: string, sessionId: string) {
  return `quizly:result_session:v1:${guardianId}:${sessionId}`;
}

async function loadResultSessionSnapshotFromDatabase(supabase: SupabaseClient, sessionId: string): Promise<ResultSessionSnapshot> {
  const [{ data: sessionData, error: sessionError }, { data: historyData, error: historyError }] = await Promise.all([
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
  ]);

  if (sessionError || !sessionData || historyError) {
    throw sessionError ?? historyError ?? new Error('Failed to load result session');
  }

  return {
    session: sessionData as ResultSession,
    history: (historyData ?? []) as ResultHistoryItem[],
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
