import type { SupabaseClient } from '@supabase/supabase-js';
import { deleteRedisKey, getRedisString, incrementRedisKey, isUpstashConfigured, setRedisString } from '@/lib/cache/upstash';

const QUIZ_QUESTION_SET_TTL_SECONDS = 10 * 60;

export type QuizQuestionRow = {
  id: string;
  genre_id: string;
  question_text: string;
  options: string[];
  correct_index: number;
  explanation: string | null;
  image_url: string | null;
};

function buildStableQuestionOrderKey(childId: string, genreId: string, questionId: string) {
  const source = `${childId}:${genreId}:${questionId}`;
  let hash = 0;

  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function buildQuizOrderVersionKey(genreId: string) {
  return `quizly:quiz_order_version:v1:${genreId}`;
}

function buildQuizQuestionSetCacheKey(genreId: string, childId: string, count: number, version: number) {
  return `quizly:quiz_question_set:v1:${genreId}:${childId}:${count}:v${version}`;
}

async function getQuizOrderVersion(genreId: string) {
  if (!isUpstashConfigured()) {
    return 0;
  }

  try {
    const raw = await getRedisString(buildQuizOrderVersionKey(genreId));
    const parsed = Number.parseInt(raw ?? '0', 10);
    return Number.isFinite(parsed) ? parsed : 0;
  } catch (error) {
    console.warn(`[quiz-question-set-cache] failed to read version genre=${genreId}`, error);
    return 0;
  }
}

export async function invalidateQuizQuestionSetCacheByGenre(genreId: string) {
  if (!isUpstashConfigured()) {
    return;
  }

  try {
    await incrementRedisKey(buildQuizOrderVersionKey(genreId));
    console.info(`[quiz-question-set-cache] invalidated genre=${genreId}`);
  } catch (error) {
    console.warn(`[quiz-question-set-cache] failed to invalidate genre=${genreId}`, error);
  }
}

async function fetchQuestionsByIds(supabase: SupabaseClient, questionIds: string[]) {
  if (questionIds.length === 0) {
    return [] as QuizQuestionRow[];
  }

  const { data, error } = await supabase
    .from('questions')
    .select('*')
    .in('id', questionIds)
    .eq('is_active', true);

  if (error) {
    throw error;
  }

  const byId = new Map(((data ?? []) as QuizQuestionRow[]).map((row) => [row.id, row] as const));
  return questionIds.map((id) => byId.get(id)).filter((row): row is QuizQuestionRow => Boolean(row));
}

async function fetchD1QuestionsByIds(db: D1Database, questionIds: string[]) {
  if (questionIds.length === 0) {
    return [] as QuizQuestionRow[];
  }

  const placeholders = questionIds.map(() => '?').join(', ');
  const result = await db
    .prepare(
      `
      SELECT id, genre_id, question_text, options, correct_index, explanation, image_url
      FROM questions
      WHERE id IN (${placeholders}) AND is_active = 1
    `,
    )
    .bind(...questionIds)
    .all<Omit<QuizQuestionRow, 'options'> & { options: string }>();

  const byId = new Map((result.results ?? []).map((row) => [
    row.id,
    {
      ...row,
      options: JSON.parse(row.options) as string[],
    } satisfies QuizQuestionRow,
  ] as const));

  return questionIds.map((id) => byId.get(id)).filter((row): row is QuizQuestionRow => Boolean(row));
}

export async function getD1QuizQuestionSet(
  db: D1Database,
  params: {
    childId: string;
    genreId: string;
    requestedCount: number | null;
  },
) {
  const startedAt = Date.now();
  const { childId, genreId, requestedCount } = params;
  const count = requestedCount && requestedCount > 0 ? requestedCount : 0;

  const version = await getQuizOrderVersion(genreId);
  const cacheKey = buildQuizQuestionSetCacheKey(genreId, childId, count, version);

  if (isUpstashConfigured()) {
    try {
      const cached = await getRedisString(cacheKey);
      if (cached) {
        const ids = JSON.parse(cached) as string[];
        const questions = await fetchD1QuestionsByIds(db, ids);

        if (questions.length === ids.length) {
          console.info(`[quiz-question-set-cache] d1-hit genre=${genreId} count=${count} elapsed_ms=${Date.now() - startedAt}`);
          return questions;
        }

        await deleteRedisKey(cacheKey);
        console.info(`[quiz-question-set-cache] d1-stale-entry-evicted genre=${genreId} count=${count}`);
      } else {
        console.info(`[quiz-question-set-cache] d1-miss genre=${genreId} count=${count}`);
      }
    } catch (error) {
      console.warn(`[quiz-question-set-cache] d1 failed to read genre=${genreId} count=${count}`, error);
    }
  }

  const result = await db
    .prepare(
      `
      SELECT id, genre_id, question_text, options, correct_index, explanation, image_url
      FROM questions
      WHERE genre_id = ? AND is_active = 1
    `,
    )
    .bind(genreId)
    .all<Omit<QuizQuestionRow, 'options'> & { options: string }>();

  const allQuestions = (result.results ?? []).map((row) => ({
    ...row,
    options: JSON.parse(row.options) as string[],
  }));
  const resolvedCount = count > 0 ? Math.min(count, allQuestions.length) : allQuestions.length;
  const selected = [...allQuestions]
    .sort(
      (left, right) =>
        buildStableQuestionOrderKey(childId, genreId, left.id) -
        buildStableQuestionOrderKey(childId, genreId, right.id),
    )
    .slice(0, resolvedCount);

  if (isUpstashConfigured()) {
    try {
      const selectedIds = selected.map((row) => row.id);
      await setRedisString(cacheKey, JSON.stringify(selectedIds), QUIZ_QUESTION_SET_TTL_SECONDS);
      console.info(`[quiz-question-set-cache] d1-rebuilt genre=${genreId} count=${count} elapsed_ms=${Date.now() - startedAt}`);
    } catch (error) {
      console.warn(`[quiz-question-set-cache] d1 failed to write genre=${genreId} count=${count}`, error);
    }
  }

  return selected;
}

export async function getQuizQuestionSet(
  supabase: SupabaseClient,
  params: {
    childId: string;
    genreId: string;
    requestedCount: number | null;
  },
) {
  const startedAt = Date.now();
  const { childId, genreId, requestedCount } = params;
  const count = requestedCount && requestedCount > 0 ? requestedCount : 0;

  const version = await getQuizOrderVersion(genreId);
  const cacheKey = buildQuizQuestionSetCacheKey(genreId, childId, count, version);

  if (isUpstashConfigured()) {
    try {
      const cached = await getRedisString(cacheKey);
      if (cached) {
        const ids = JSON.parse(cached) as string[];
        const questions = await fetchQuestionsByIds(supabase, ids);

        if (questions.length === ids.length) {
          console.info(`[quiz-question-set-cache] hit genre=${genreId} count=${count} elapsed_ms=${Date.now() - startedAt}`);
          return questions;
        }

        await deleteRedisKey(cacheKey);
        console.info(`[quiz-question-set-cache] stale-entry-evicted genre=${genreId} count=${count}`);
      } else {
        console.info(`[quiz-question-set-cache] miss genre=${genreId} count=${count}`);
      }
    } catch (error) {
      console.warn(`[quiz-question-set-cache] failed to read genre=${genreId} count=${count}`, error);
    }
  }

  const { data, error: questionsError } = await supabase
    .from('questions')
    .select('*')
    .eq('genre_id', genreId)
    .eq('is_active', true);

  if (questionsError) {
    throw questionsError;
  }

  const allQuestions = (data ?? []) as QuizQuestionRow[];
  const resolvedCount = count > 0 ? Math.min(count, allQuestions.length) : allQuestions.length;
  const selected = [...allQuestions]
    .sort(
      (left, right) =>
        buildStableQuestionOrderKey(childId, genreId, left.id) -
        buildStableQuestionOrderKey(childId, genreId, right.id),
    )
    .slice(0, resolvedCount);

  if (isUpstashConfigured()) {
    try {
      const selectedIds = selected.map((row) => row.id);
      await setRedisString(cacheKey, JSON.stringify(selectedIds), QUIZ_QUESTION_SET_TTL_SECONDS);
      console.info(`[quiz-question-set-cache] rebuilt genre=${genreId} count=${count} elapsed_ms=${Date.now() - startedAt}`);
    } catch (error) {
      console.warn(`[quiz-question-set-cache] failed to write genre=${genreId} count=${count}`, error);
    }
  }

  return selected;
}
