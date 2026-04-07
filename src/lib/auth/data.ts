import type { SupabaseClient, User } from '@supabase/supabase-js';
import { isParentReauthUnlocked } from '@/lib/auth/parentReauth';
import { deleteRedisKey, getRedisString, isUpstashConfigured, setRedisString } from '@/lib/cache/upstash';

export type ChildProfile = {
  id: string;
  display_name: string;
  total_points: number;
  avatar_url: string | null;
};

export type DashboardActiveChild = {
  id: string;
  display_name: string;
  total_points: number;
};

export type DashboardGenreWithQuestionCount = {
  id: string;
  name: string;
  icon_key: string;
  description: string | null;
  color_hint: string | null;
  parent_id: string | null;
  question_count: number;
};

export type ParentManagedChild = {
  id: string;
  display_name: string;
  total_points: number;
  avatar_url: string | null;
  created_at: string;
  last_studied_at: string | null;
  session_count: number;
};

export type ParentGenre = {
  id: string;
  name: string;
  parent_id: string | null;
};

export type ParentSessionSummary = {
  id: string;
  child_id: string;
  genre_id: string | null;
  mode: string;
  total_questions: number;
  correct_count: number;
  earned_points: number;
  started_at: string;
  completed_at: string | null;
  genre_name: string | null;
  parent_genre_id: string | null;
  color_hint: string | null;
};

export type ParentSessionHistoryItem = {
  session_id: string;
  child_id: string;
  question_id: string;
  is_correct: boolean;
  selected_index: number;
  answered_at: string;
  question_text: string;
  options: string[];
  correct_index: number;
  explanation: string | null;
};

export type ParentManagementSnapshot = {
  children: ParentManagedChild[];
  sessions: ParentSessionSummary[];
  historyItems: ParentSessionHistoryItem[];
  parentGenres: ParentGenre[];
  leafGenres: ParentGenre[];
};

export type StudyStatus = 'unattempted' | 'studied_not_perfect' | 'perfect_cleared';

type ChildStudyStatusRow = {
  genre_id: string;
  study_status: StudyStatus | null;
};

type ParentSessionGenreRow = {
  name: string;
  parent_id: string | null;
  color_hint: string | null;
};

type ParentSessionRow = {
  id: string;
  child_id: string;
  genre_id: string | null;
  mode: string;
  total_questions: number;
  correct_count: number;
  earned_points: number;
  started_at: string;
  completed_at: string | null;
  genres: ParentSessionGenreRow | ParentSessionGenreRow[] | null;
};

type ParentHistoryQuestionRow = {
  question_text: string;
  options: string[];
  correct_index: number;
  explanation: string | null;
};

type ParentHistoryRow = {
  session_id: string;
  child_id: string;
  question_id: string;
  is_correct: boolean;
  selected_index: number;
  answered_at: string;
  questions: ParentHistoryQuestionRow | ParentHistoryQuestionRow[] | null;
};

type DashboardQuestionCountRow = {
  genre_id: string;
  question_count: number | string;
};

type DashboardGenreRow = {
  id: string;
  name: string;
  icon_key: string;
  description: string | null;
  color_hint: string | null;
  parent_id: string | null;
};

const PARENT_MANAGEMENT_SNAPSHOT_TTL_SECONDS = 5 * 60;
const DASHBOARD_CATALOG_TTL_SECONDS = 10 * 60;

function buildParentManagementSnapshotCacheKey(guardianId: string) {
  return `quizly:parent_snapshot:v1:${guardianId}`;
}

function buildDashboardCatalogCacheKey() {
  return 'quizly:dashboard:catalog:v2';
}

export async function ensureGuardianProfile(supabase: SupabaseClient, user: User) {
  const fallbackName = user.user_metadata?.name ?? user.email?.split('@')[0] ?? '保護者';

  await supabase.from('guardian_accounts').upsert(
    {
      id: user.id,
      email: user.email ?? null,
      display_name: String(fallbackName),
    },
    { onConflict: 'id' },
  );
}

export async function listChildProfiles(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('child_profiles')
    .select('id, display_name, total_points, avatar_url')
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as ChildProfile[];
}

export async function getDashboardSnapshot(supabase: SupabaseClient, activeChildId: string) {
  const [{ data: child }, { count: childCount }, { data: studyStatusRows, error: studyStatusError }] = await Promise.all([
    supabase
      .from('child_profiles')
      .select('id, display_name, total_points')
      .eq('id', activeChildId)
      .maybeSingle(),
    supabase.from('child_profiles').select('id', { count: 'exact', head: true }),
    supabase.rpc('get_child_study_status', { p_child_id: activeChildId }),
  ]);

  if (!child || studyStatusError) {
    return null;
  }

  const studyStatusByGenreId = ((studyStatusRows ?? []) as ChildStudyStatusRow[]).reduce<Record<string, StudyStatus>>(
    (acc, row) => {
      if (!row.genre_id || !row.study_status) {
        return acc;
      }
      acc[row.genre_id] = row.study_status;
      return acc;
    },
    {},
  );

  return {
    activeChild: child as DashboardActiveChild,
    canSwitchChild: (childCount ?? 0) > 1,
    studyStatusByGenreId,
  };
}

async function loadDashboardGenreCatalogFromDatabase(supabase: SupabaseClient): Promise<DashboardGenreWithQuestionCount[]> {
  const [{ data: genres, error: genresError }, { data: questionCounts, error: questionCountsError }] = await Promise.all([
    supabase
      .from('genres')
      .select('*')
      .order('parent_id', { ascending: true, nullsFirst: true })
      .order('id', { ascending: true }),
    supabase.rpc('get_active_question_counts'),
  ]);

  if (genresError) {
    throw genresError;
  }

  if (questionCountsError) {
    throw questionCountsError;
  }

  const questionCountByGenreId = ((questionCounts ?? []) as DashboardQuestionCountRow[]).reduce((acc: Record<string, number>, row) => {
    acc[row.genre_id] = Number(row.question_count ?? 0);
    return acc;
  }, {});

  const catalog = ((genres ?? []) as DashboardGenreRow[]).map((genre) => ({
    ...genre,
    question_count: questionCountByGenreId[genre.id] ?? 0,
  }));

  const visibleParentIds = new Set(
    catalog
      .filter((genre) => genre.parent_id != null && genre.question_count > 0)
      .map((genre) => genre.parent_id)
      .filter((parentId): parentId is string => Boolean(parentId)),
  );

  return catalog.filter((genre) => {
    if (genre.parent_id == null) {
      return visibleParentIds.has(genre.id) || genre.question_count > 0;
    }
    return genre.question_count > 0;
  });
}

export async function getDashboardGenreCatalog(supabase: SupabaseClient): Promise<DashboardGenreWithQuestionCount[]> {
  const startedAt = Date.now();
  const cacheKey = buildDashboardCatalogCacheKey();

  if (isUpstashConfigured()) {
    try {
      const cached = await getRedisString(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as DashboardGenreWithQuestionCount[];
        console.info(`[dashboard-catalog-cache] hit elapsed_ms=${Date.now() - startedAt}`);
        return parsed;
      }
      console.info('[dashboard-catalog-cache] miss');
    } catch (error) {
      console.warn('[dashboard-catalog-cache] failed to read cache', error);
    }
  }

  const catalog = await loadDashboardGenreCatalogFromDatabase(supabase);
  console.info(`[dashboard-catalog-cache] rebuilt elapsed_ms=${Date.now() - startedAt}`);

  if (isUpstashConfigured()) {
    try {
      await setRedisString(cacheKey, JSON.stringify(catalog), DASHBOARD_CATALOG_TTL_SECONDS);
    } catch (error) {
      console.warn('[dashboard-catalog-cache] failed to write cache', error);
    }
  }

  return catalog;
}

export async function invalidateDashboardCatalogCache() {
  if (!isUpstashConfigured()) {
    return;
  }

  try {
    await deleteRedisKey(buildDashboardCatalogCacheKey());
    console.info('[dashboard-catalog-cache] invalidated');
  } catch (error) {
    console.warn('[dashboard-catalog-cache] failed to invalidate', error);
  }
}

export async function isParentUnlocked(supabase: SupabaseClient, guardianId: string) {
  return isParentReauthUnlocked(supabase, guardianId);
}

export async function invalidateParentManagementSnapshotCache(guardianId: string) {
  if (!isUpstashConfigured()) {
    return;
  }

  const cacheKey = buildParentManagementSnapshotCacheKey(guardianId);

  try {
    await deleteRedisKey(cacheKey);
    console.info(`[parent-snapshot-cache] invalidated guardian=${guardianId}`);
  } catch (error) {
    console.warn(`[parent-snapshot-cache] failed to invalidate guardian=${guardianId}`, error);
  }
}

async function loadParentManagementSnapshotFromDatabase(supabase: SupabaseClient): Promise<ParentManagementSnapshot> {
  const [{ data: childrenData, error: childrenError }, { data: sessionsData, error: sessionsError }, { data: historyData, error: historyError }, { data: allGenresData, error: allGenresError }] =
    await Promise.all([
      supabase
        .from('child_profiles')
        .select('id, display_name, total_points, avatar_url, created_at')
        .order('created_at', { ascending: true }),
      supabase
        .from('study_sessions')
        .select(
          `
          id,
          child_id,
          genre_id,
          mode,
          total_questions,
          correct_count,
          earned_points,
          started_at,
          completed_at,
          genres (
            name,
            parent_id,
            color_hint
          )
        `,
        )
        .order('completed_at', { ascending: false, nullsFirst: false }),
      supabase
        .from('study_history')
        .select(
          `
          session_id,
          child_id,
          question_id,
          is_correct,
          selected_index,
          answered_at,
          questions (
            question_text,
            options,
            correct_index,
            explanation
          )
        `,
        )
        .order('answered_at', { ascending: false }),
      supabase
        .from('genres')
        .select('id, name, parent_id')
        .order('name', { ascending: true }),
    ]);

  if (childrenError) throw childrenError;
  if (sessionsError) throw sessionsError;
  if (historyError) throw historyError;
  if (allGenresError) throw allGenresError;

  const sessions = ((sessionsData ?? []) as ParentSessionRow[]).map((session) => {
    const genre = Array.isArray(session.genres) ? session.genres[0] : session.genres;

    return {
      id: session.id,
      child_id: session.child_id,
      genre_id: session.genre_id,
      mode: session.mode,
      total_questions: session.total_questions,
      correct_count: session.correct_count,
      earned_points: session.earned_points,
      started_at: session.started_at,
      completed_at: session.completed_at,
      genre_name: genre?.name ?? null,
      parent_genre_id: genre?.parent_id ?? null,
      color_hint: genre?.color_hint ?? null,
    } satisfies ParentSessionSummary;
  });

  const childStats = new Map<string, { sessionCount: number; lastStudiedAt: string | null }>();

  for (const session of sessions) {
    const current = childStats.get(session.child_id) ?? { sessionCount: 0, lastStudiedAt: null };
    const completedAt = session.completed_at ?? session.started_at;

    current.sessionCount += 1;
    if (!current.lastStudiedAt || completedAt > current.lastStudiedAt) {
      current.lastStudiedAt = completedAt;
    }
    childStats.set(session.child_id, current);
  }

  const children = ((childrenData ?? []) as Array<{
    id: string;
    display_name: string;
    total_points: number;
    avatar_url: string | null;
    created_at: string;
  }>).map((child) => {
    const stats = childStats.get(child.id);

    return {
      ...child,
      last_studied_at: stats?.lastStudiedAt ?? null,
      session_count: stats?.sessionCount ?? 0,
    } satisfies ParentManagedChild;
  });

  const historyItems = ((historyData ?? []) as ParentHistoryRow[])
    .map((item) => {
      const question = Array.isArray(item.questions) ? item.questions[0] : item.questions;
      if (!question) return null;

      return {
        session_id: item.session_id,
        child_id: item.child_id,
        question_id: item.question_id,
        is_correct: item.is_correct,
        selected_index: item.selected_index,
        answered_at: item.answered_at,
        question_text: question.question_text,
        options: question.options,
        correct_index: question.correct_index,
        explanation: question.explanation,
      } satisfies ParentSessionHistoryItem;
    })
    .filter((item): item is ParentSessionHistoryItem => Boolean(item));

  const allGenres = (allGenresData ?? []) as ParentGenre[];

  return {
    children,
    sessions,
    historyItems,
    parentGenres: allGenres.filter((genre) => genre.parent_id == null),
    leafGenres: allGenres.filter((genre) => genre.parent_id != null),
  };
}

export async function getParentManagementSnapshot(supabase: SupabaseClient, guardianId: string): Promise<ParentManagementSnapshot> {
  const startedAt = Date.now();
  const cacheKey = buildParentManagementSnapshotCacheKey(guardianId);

  if (isUpstashConfigured()) {
    try {
      const cached = await getRedisString(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as ParentManagementSnapshot;
        console.info(`[parent-snapshot-cache] hit guardian=${guardianId} elapsed_ms=${Date.now() - startedAt}`);
        return parsed;
      }
      console.info(`[parent-snapshot-cache] miss guardian=${guardianId}`);
    } catch (error) {
      console.warn(`[parent-snapshot-cache] failed to read guardian=${guardianId}`, error);
    }
  }

  const snapshot = await loadParentManagementSnapshotFromDatabase(supabase);
  console.info(`[parent-snapshot-cache] rebuilt guardian=${guardianId} elapsed_ms=${Date.now() - startedAt}`);

  if (isUpstashConfigured()) {
    try {
      await setRedisString(cacheKey, JSON.stringify(snapshot), PARENT_MANAGEMENT_SNAPSHOT_TTL_SECONDS);
    } catch (error) {
      console.warn(`[parent-snapshot-cache] failed to write guardian=${guardianId}`, error);
    }
  }

  return snapshot;
}

export async function getParentGateState(supabase: SupabaseClient, guardianId: string) {
  const [pinResult, unlocked] = await Promise.all([
    supabase
      .from('guardian_accounts')
      .select('parent_pin_hash')
      .eq('id', guardianId)
      .single(),
    isParentUnlocked(supabase, guardianId),
  ]);

  if (pinResult.error) {
    throw pinResult.error;
  }

  return {
    hasParentPin: Boolean(pinResult.data?.parent_pin_hash),
    unlocked,
  };
}
