import type { SupabaseClient } from '@supabase/supabase-js';
import { deleteRedisKey, getRedisString, isUpstashConfigured, setRedisString } from '@/lib/cache/upstash';

const BADGE_OVERVIEW_CACHE_TTL_SECONDS = 60;
const BADGE_SUMMARY_CACHE_TTL_SECONDS = 60;

export type BadgeOverviewUnlocked = {
  key: string;
  name: string;
  icon_path: string;
  is_secret: boolean;
  unlocked_at: string;
  detail_text: string;
};

export type BadgeOverviewTarget = {
  key: string;
  family: string;
  name: string;
  icon_path: string;
  current: number;
  threshold: number;
  progress_percent: number;
};

export type BadgeOverviewSubjectProgress = {
  subject_id: string;
  subject_name: string;
  current: number;
  next_level: number | null;
  next_threshold: number | null;
  progress_percent: number;
  next_badge_icon_path: string | null;
};

export type BadgeOverview = {
  current_streak: number;
  shield_remaining: number;
  unlocked_badges: BadgeOverviewUnlocked[];
  recent_unlocked: BadgeOverviewUnlocked[];
  next_targets: BadgeOverviewTarget[];
  subject_progress: BadgeOverviewSubjectProgress[];
};

export type BadgeSummary = {
  current_streak: number;
  unlocked_count: number;
};

type BadgeDefinitionRow = {
  key: string;
  family: string;
  level: number | null;
  name: string;
  icon_path: string;
  is_secret: boolean;
  condition_json: { threshold?: number; subject_id?: string; type?: string } | null;
};

type ChildBadgeRow = {
  badge_key: string;
  unlocked_at: string;
};

type SessionRow = {
  genre_id: string | null;
  total_questions: number;
  correct_count: number;
};

type GenreRow = {
  id: string;
  name: string;
  parent_id: string | null;
};

type D1BadgeDefinitionRow = Omit<BadgeDefinitionRow, 'is_secret' | 'condition_json'> & {
  is_secret: number;
  condition_json: string | null;
};

type D1StreakStateRow = {
  current_streak_days: number;
  weekly_shield_count: number;
};

type ChildTotalPointsRow = {
  total_points: number;
};

function thresholdOf(definition: BadgeDefinitionRow) {
  return Number(definition.condition_json?.threshold ?? 0);
}

function progressPercent(current: number, threshold: number) {
  if (threshold <= 0) return 0;
  return Math.max(0, Math.min(100, Math.floor((current / threshold) * 100)));
}

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
      return '教科';
  }
}

function buildBadgeDetailText(definition: BadgeDefinitionRow) {
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
    return `全問正解を${threshold}回達成`;
  }
  if (definition.family === 'genre_explorer') {
    return `${threshold}種類のジャンルに挑戦`;
  }
  if (definition.family === 'total_points') {
    return `累計${threshold}pt達成`;
  }
  if (definition.family === 'subject_master') {
    return `${resolveSubjectName(condition.subject_id)}を${threshold}回学習`;
  }

  return '条件を達成';
}

function buildBadgeOverviewCacheKey(childId: string) {
  return `quizly:badge_overview:overview:v1:${childId}`;
}

function buildBadgeSummaryCacheKey(childId: string) {
  return `quizly:badge_overview:summary:v1:${childId}`;
}

function normalizeD1BadgeDefinition(row: D1BadgeDefinitionRow): BadgeDefinitionRow {
  return {
    ...row,
    is_secret: Boolean(row.is_secret),
    condition_json: row.condition_json
      ? JSON.parse(row.condition_json) as BadgeDefinitionRow['condition_json']
      : null,
  };
}

function buildBadgeOverviewFromRows({
  streakState,
  badgeDefinitions,
  childBadges,
  sessions,
  genres,
  childTotalPoints,
}: {
  streakState: { current_streak_days: number; weekly_shield_count: number } | null;
  badgeDefinitions: BadgeDefinitionRow[];
  childBadges: ChildBadgeRow[];
  sessions: SessionRow[];
  genres: GenreRow[];
  childTotalPoints: number;
}): BadgeOverview {
  const unlockedKeySet = new Set(childBadges.map((row) => row.badge_key));
  const badgeDefinitionByKey = new Map(badgeDefinitions.map((row) => [row.key, row] as const));

  const unlockedBadges: BadgeOverviewUnlocked[] = childBadges
    .map((row) => {
      const definition = badgeDefinitionByKey.get(row.badge_key);
      if (!definition) return null;
      return {
        key: definition.key,
        name: definition.name,
        icon_path: definition.icon_path,
        is_secret: definition.is_secret,
        unlocked_at: row.unlocked_at,
        detail_text: buildBadgeDetailText(definition),
      } satisfies BadgeOverviewUnlocked;
    })
    .filter((row): row is BadgeOverviewUnlocked => Boolean(row));

  const currentStreak = Number(streakState?.current_streak_days ?? 0);
  const shieldRemaining = Number(streakState?.weekly_shield_count ?? 1);

  const perfectCount = sessions.filter((session) => session.total_questions > 0 && session.correct_count === session.total_questions).length;
  const genreCount = new Set(sessions.map((session) => session.genre_id).filter((id): id is string => Boolean(id))).size;

  const parentGenreById = new Map(genres.filter((genre) => genre.parent_id == null).map((genre) => [genre.id, genre] as const));
  const genreParentById = new Map(genres.map((genre) => [genre.id, genre.parent_id] as const));

  const subjectSessionCountByParentId = new Map<string, number>();
  for (const session of sessions) {
    if (!session.genre_id) continue;
    const parentId = genreParentById.get(session.genre_id) ?? null;
    const subjectId = parentId ?? session.genre_id;
    const current = subjectSessionCountByParentId.get(subjectId) ?? 0;
    subjectSessionCountByParentId.set(subjectId, current + 1);
  }

  const nextTargets: BadgeOverviewTarget[] = [];

  const familyCurrentValue: Record<string, number> = {
    streak_days: currentStreak,
    perfect_sessions: perfectCount,
    genre_explorer: genreCount,
    total_points: childTotalPoints,
  };

  for (const family of ['streak_days', 'perfect_sessions', 'genre_explorer', 'total_points'] as const) {
    const definitions = badgeDefinitions
      .filter((definition) => definition.family === family && !definition.is_secret && definition.level != null)
      .sort((a, b) => (a.level ?? 0) - (b.level ?? 0));
    const nextDefinition = definitions.find((definition) => !unlockedKeySet.has(definition.key));
    if (!nextDefinition) continue;

    const threshold = thresholdOf(nextDefinition);
    const current = familyCurrentValue[family] ?? 0;
    nextTargets.push({
      key: nextDefinition.key,
      family,
      name: nextDefinition.name,
      icon_path: nextDefinition.icon_path,
      current,
      threshold,
      progress_percent: progressPercent(current, threshold),
    });
  }

  const subjectProgress: BadgeOverviewSubjectProgress[] = [];
  for (const parentGenre of parentGenreById.values()) {
    const definitions = badgeDefinitions
      .filter(
        (definition) =>
          definition.family === 'subject_master' &&
          !definition.is_secret &&
          definition.level != null &&
          definition.condition_json?.subject_id === parentGenre.id,
      )
      .sort((a, b) => (a.level ?? 0) - (b.level ?? 0));

    if (definitions.length === 0) continue;

    const nextDefinition = definitions.find((definition) => !unlockedKeySet.has(definition.key)) ?? null;
    const current = subjectSessionCountByParentId.get(parentGenre.id) ?? 0;

    if (!nextDefinition) {
      const maxDefinition = definitions.at(-1) ?? null;
      subjectProgress.push({
        subject_id: parentGenre.id,
        subject_name: parentGenre.name,
        current,
        next_level: null,
        next_threshold: null,
        progress_percent: 100,
        next_badge_icon_path: maxDefinition?.icon_path ?? null,
      });
      continue;
    }

    const threshold = thresholdOf(nextDefinition);
    subjectProgress.push({
      subject_id: parentGenre.id,
      subject_name: parentGenre.name,
      current,
      next_level: nextDefinition.level,
      next_threshold: threshold,
      progress_percent: progressPercent(current, threshold),
      next_badge_icon_path: nextDefinition.icon_path,
    });
  }

  return {
    current_streak: currentStreak,
    shield_remaining: shieldRemaining,
    unlocked_badges: unlockedBadges,
    recent_unlocked: unlockedBadges.slice(0, 5),
    next_targets: nextTargets,
    subject_progress: subjectProgress.sort((a, b) => a.subject_name.localeCompare(b.subject_name, 'ja')),
  };
}

async function loadBadgeOverviewFromDatabase(
  supabase: SupabaseClient,
  params: { childId: string },
): Promise<BadgeOverview> {
  const { childId } = params;

  const [{ data: streakStateData, error: streakStateError }, { data: badgeDefinitionsData, error: badgeDefinitionsError }, { data: childBadgesData, error: childBadgesError }, { data: sessionsData, error: sessionsError }, { data: genresData, error: genresError }, { data: childProfileData, error: childProfileError }] = await Promise.all([
    supabase
      .from('child_streak_state')
      .select('current_streak_days, weekly_shield_count')
      .eq('child_id', childId)
      .maybeSingle(),
    supabase
      .from('badge_definitions')
      .select('key, family, level, name, icon_path, is_secret, condition_json')
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
    supabase
      .from('child_badges')
      .select('badge_key, unlocked_at')
      .eq('child_id', childId)
      .order('unlocked_at', { ascending: false }),
    supabase
      .from('study_sessions')
      .select('genre_id, total_questions, correct_count')
      .eq('child_id', childId),
    supabase
      .from('genres')
      .select('id, name, parent_id'),
    supabase
      .from('child_profiles')
      .select('total_points')
      .eq('id', childId)
      .maybeSingle(),
  ]);

  if (streakStateError || badgeDefinitionsError || childBadgesError || sessionsError || genresError || childProfileError) {
    throw streakStateError ?? badgeDefinitionsError ?? childBadgesError ?? sessionsError ?? genresError ?? childProfileError;
  }

  const streakState = streakStateData as { current_streak_days: number; weekly_shield_count: number } | null;
  const badgeDefinitions = (badgeDefinitionsData ?? []) as BadgeDefinitionRow[];
  const childBadges = (childBadgesData ?? []) as ChildBadgeRow[];
  const sessions = (sessionsData ?? []) as SessionRow[];
  const genres = (genresData ?? []) as GenreRow[];
  const childTotalPoints = Number((childProfileData as { total_points?: number } | null)?.total_points ?? 0);

  return buildBadgeOverviewFromRows({
    streakState,
    badgeDefinitions,
    childBadges,
    sessions,
    genres,
    childTotalPoints,
  });
}

async function loadBadgeSummaryFromDatabase(
  supabase: SupabaseClient,
  params: { childId: string },
): Promise<BadgeSummary> {
  const { childId } = params;
  const [{ data: streakStateData, error: streakStateError }, { count: unlockedCount, error: badgeCountError }] = await Promise.all([
    supabase
      .from('child_streak_state')
      .select('current_streak_days')
      .eq('child_id', childId)
      .maybeSingle(),
    supabase
      .from('child_badges')
      .select('id', { count: 'exact', head: true })
      .eq('child_id', childId),
  ]);

  if (streakStateError || badgeCountError) {
    throw streakStateError ?? badgeCountError;
  }

  const streakState = streakStateData as { current_streak_days: number } | null;
  return {
    current_streak: Number(streakState?.current_streak_days ?? 0),
    unlocked_count: Number(unlockedCount ?? 0),
  };
}

async function loadD1BadgeOverviewFromDatabase(
  db: D1Database,
  params: { childId: string; guardianId: string },
): Promise<BadgeOverview | null> {
  const { childId, guardianId } = params;

  const [
    childProfile,
    streakState,
    badgeDefinitionsData,
    childBadgesData,
    sessionsData,
    genresData,
  ] = await Promise.all([
    db
      .prepare(
        `
        SELECT total_points
        FROM child_profiles
        WHERE id = ? AND guardian_id = ?
        LIMIT 1
      `,
      )
      .bind(childId, guardianId)
      .first<ChildTotalPointsRow>(),
    db
      .prepare(
        `
        SELECT current_streak_days, weekly_shield_count
        FROM child_streak_state
        WHERE child_id = ?
        LIMIT 1
      `,
      )
      .bind(childId)
      .first<D1StreakStateRow>(),
    db
      .prepare(
        `
        SELECT key, family, level, name, icon_path, is_secret, condition_json
        FROM badge_definitions
        WHERE is_active = 1
        ORDER BY sort_order ASC
      `,
      )
      .all<D1BadgeDefinitionRow>(),
    db
      .prepare(
        `
        SELECT cb.badge_key, cb.unlocked_at
        FROM child_badges cb
        JOIN child_profiles cp ON cp.id = cb.child_id
        WHERE cb.child_id = ? AND cp.guardian_id = ?
        ORDER BY cb.unlocked_at DESC
      `,
      )
      .bind(childId, guardianId)
      .all<ChildBadgeRow>(),
    db
      .prepare(
        `
        SELECT ss.genre_id, ss.total_questions, ss.correct_count
        FROM study_sessions ss
        JOIN child_profiles cp ON cp.id = ss.child_id
        WHERE ss.child_id = ? AND cp.guardian_id = ?
      `,
      )
      .bind(childId, guardianId)
      .all<SessionRow>(),
    db
      .prepare('SELECT id, name, parent_id FROM genres')
      .all<GenreRow>(),
  ]);

  if (!childProfile) {
    return null;
  }

  return buildBadgeOverviewFromRows({
    streakState,
    badgeDefinitions: (badgeDefinitionsData.results ?? []).map(normalizeD1BadgeDefinition),
    childBadges: childBadgesData.results ?? [],
    sessions: sessionsData.results ?? [],
    genres: genresData.results ?? [],
    childTotalPoints: Number(childProfile.total_points ?? 0),
  });
}

async function loadD1BadgeSummaryFromDatabase(
  db: D1Database,
  params: { childId: string; guardianId: string },
): Promise<BadgeSummary | null> {
  const { childId, guardianId } = params;
  const [child, streakState, badgeCountRow] = await Promise.all([
    db
      .prepare('SELECT id FROM child_profiles WHERE id = ? AND guardian_id = ? LIMIT 1')
      .bind(childId, guardianId)
      .first<{ id: string }>(),
    db
      .prepare(
        `
        SELECT current_streak_days
        FROM child_streak_state
        WHERE child_id = ?
        LIMIT 1
      `,
      )
      .bind(childId)
      .first<{ current_streak_days: number }>(),
    db
      .prepare(
        `
        SELECT COUNT(*) AS count
        FROM child_badges cb
        JOIN child_profiles cp ON cp.id = cb.child_id
        WHERE cb.child_id = ? AND cp.guardian_id = ?
      `,
      )
      .bind(childId, guardianId)
      .first<{ count: number }>(),
  ]);

  if (!child) {
    return null;
  }

  return {
    current_streak: Number(streakState?.current_streak_days ?? 0),
    unlocked_count: Number(badgeCountRow?.count ?? 0),
  };
}

export async function invalidateBadgeOverviewCache(childId: string) {
  if (!isUpstashConfigured()) {
    return;
  }

  const overviewKey = buildBadgeOverviewCacheKey(childId);
  const summaryKey = buildBadgeSummaryCacheKey(childId);

  await Promise.all([
    deleteRedisKey(overviewKey).catch((error) => {
      console.warn(`[badge-overview-cache] failed to invalidate overview child=${childId}`, error);
    }),
    deleteRedisKey(summaryKey).catch((error) => {
      console.warn(`[badge-overview-cache] failed to invalidate summary child=${childId}`, error);
    }),
  ]);
}

export async function getBadgeOverview(
  supabase: SupabaseClient,
  params: { childId: string },
): Promise<BadgeOverview> {
  const startedAt = Date.now();
  const { childId } = params;
  const cacheKey = buildBadgeOverviewCacheKey(childId);

  if (isUpstashConfigured()) {
    try {
      const cached = await getRedisString(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as BadgeOverview;
        console.info(`[badge-overview-cache] hit child=${childId} elapsed_ms=${Date.now() - startedAt}`);
        return parsed;
      }
      console.info(`[badge-overview-cache] miss child=${childId}`);
    } catch (error) {
      console.warn(`[badge-overview-cache] failed to read child=${childId}`, error);
    }
  }

  const overview = await loadBadgeOverviewFromDatabase(supabase, { childId });
  console.info(`[badge-overview-cache] rebuilt child=${childId} elapsed_ms=${Date.now() - startedAt}`);

  if (isUpstashConfigured()) {
    try {
      await setRedisString(cacheKey, JSON.stringify(overview), BADGE_OVERVIEW_CACHE_TTL_SECONDS);
    } catch (error) {
      console.warn(`[badge-overview-cache] failed to write child=${childId}`, error);
    }
  }

  return overview;
}

export async function getBadgeSummary(
  supabase: SupabaseClient,
  params: { childId: string },
): Promise<BadgeSummary> {
  const startedAt = Date.now();
  const { childId } = params;
  const cacheKey = buildBadgeSummaryCacheKey(childId);

  if (isUpstashConfigured()) {
    try {
      const cached = await getRedisString(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as BadgeSummary;
        console.info(`[badge-summary-cache] hit child=${childId} elapsed_ms=${Date.now() - startedAt}`);
        return parsed;
      }
      console.info(`[badge-summary-cache] miss child=${childId}`);
    } catch (error) {
      console.warn(`[badge-summary-cache] failed to read child=${childId}`, error);
    }
  }

  const summary = await loadBadgeSummaryFromDatabase(supabase, { childId });
  console.info(`[badge-summary-cache] rebuilt child=${childId} elapsed_ms=${Date.now() - startedAt}`);

  if (isUpstashConfigured()) {
    try {
      await setRedisString(cacheKey, JSON.stringify(summary), BADGE_SUMMARY_CACHE_TTL_SECONDS);
    } catch (error) {
      console.warn(`[badge-summary-cache] failed to write child=${childId}`, error);
    }
  }

  return summary;
}

export async function getD1BadgeOverview(
  db: D1Database,
  params: { childId: string; guardianId: string },
): Promise<BadgeOverview | null> {
  return loadD1BadgeOverviewFromDatabase(db, params);
}

export async function getD1BadgeSummary(
  db: D1Database,
  params: { childId: string; guardianId: string },
): Promise<BadgeSummary | null> {
  return loadD1BadgeSummaryFromDatabase(db, params);
}
