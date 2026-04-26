import type { SupabaseClient } from '@supabase/supabase-js';

type HistoryRecord = {
  question_id: string;
  is_correct: boolean;
  selected_index: number;
};

type PointTransaction = {
  points: number;
  reason: string;
};

type BadgeDefinitionRow = {
  key: string;
  family: string;
  name: string;
  icon_path: string;
  is_secret: boolean;
  condition_json: { threshold?: number; subject_id?: string; type?: string } | null;
};

type CompleteStudySessionParams = {
  childId: string;
  genreId: string;
  mode: string;
  totalQuestions: number;
  correctCount: number;
  earnedPoints: number;
  completedAt: string;
  completedDateJst: string;
  historyRecords: HistoryRecord[];
  pointTransactions: PointTransaction[];
};

type StreakState = {
  current_streak_days: number;
  longest_streak_days: number;
  last_studied_date: string | null;
  weekly_shield_count: number;
  shield_week_key: string | null;
};

type LearningStats = {
  perfect_session_count: number;
  genre_explorer_count: number;
};

type D1StudySessionRow = {
  total_questions: number;
  correct_count: number;
  started_at: string;
  completed_at: string | null;
};

type D1BadgeDefinitionRow = Omit<BadgeDefinitionRow, 'is_secret' | 'condition_json'> & {
  is_secret: number | boolean;
  condition_json: string | BadgeDefinitionRow['condition_json'];
};

export type UnlockedBadge = {
  key: string;
  name: string;
  icon_path: string;
  is_secret: boolean;
};

export type CompleteStudySessionServiceResult = {
  sessionId: string;
  unlockedBadges: UnlockedBadge[];
};

function getIsoWeekKey(dateString: string) {
  const date = new Date(`${dateString}T00:00:00Z`);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-${String(week).padStart(2, '0')}`;
}

function dayDiff(left: string, right: string) {
  const leftTime = new Date(`${left}T00:00:00Z`).getTime();
  const rightTime = new Date(`${right}T00:00:00Z`).getTime();
  return Math.round((leftTime - rightTime) / 86400000);
}

function thresholdOf(definition: BadgeDefinitionRow) {
  return Number(definition.condition_json?.threshold ?? 0);
}

function toUnlockedBadge(definition: BadgeDefinitionRow): UnlockedBadge {
  return {
    key: definition.key,
    name: definition.name,
    icon_path: definition.icon_path,
    is_secret: definition.is_secret,
  };
}

function normalizeBadgeDefinition(definition: D1BadgeDefinitionRow): BadgeDefinitionRow {
  const rawCondition = definition.condition_json;
  let conditionJson: BadgeDefinitionRow['condition_json'] = null;

  if (typeof rawCondition === 'string' && rawCondition.length > 0) {
    conditionJson = JSON.parse(rawCondition) as BadgeDefinitionRow['condition_json'];
  } else if (rawCondition && typeof rawCondition === 'object') {
    conditionJson = rawCondition;
  }

  return {
    ...definition,
    is_secret: Boolean(definition.is_secret),
    condition_json: conditionJson,
  };
}

function asSqlBoolean(value: boolean) {
  return value ? 1 : 0;
}

async function insertD1UnlockedBadges(
  db: D1Database,
  params: {
    childId: string;
    sessionId: string;
    completedAt: string;
    definitions: BadgeDefinitionRow[];
    latestProgress: number;
  },
) {
  const { childId, sessionId, completedAt, definitions, latestProgress } = params;
  if (definitions.length === 0) {
    return { unlockedBadges: [] as UnlockedBadge[], statements: [] as D1PreparedStatement[] };
  }

  const placeholders = definitions.map(() => '?').join(', ');
  const existingResult = await db
    .prepare(`SELECT badge_key FROM child_badges WHERE child_id = ? AND badge_key IN (${placeholders})`)
    .bind(childId, ...definitions.map((definition) => definition.key))
    .all<{ badge_key: string }>();
  const existingKeys = new Set((existingResult.results ?? []).map((row) => row.badge_key));
  const newDefinitions = definitions.filter((definition) => !existingKeys.has(definition.key));

  return {
    unlockedBadges: newDefinitions.map(toUnlockedBadge),
    statements: newDefinitions.flatMap((definition) => [
      db
        .prepare(
          `
          INSERT OR IGNORE INTO child_badges (
            child_id, badge_key, unlocked_at, session_id, latest_progress
          ) VALUES (?, ?, ?, ?, ?)
        `,
        )
        .bind(childId, definition.key, completedAt, sessionId, latestProgress),
      db
        .prepare(
          `
          INSERT INTO badge_unlock_events (
            id, child_id, badge_key, session_id, created_at
          ) VALUES (?, ?, ?, ?, ?)
        `,
        )
        .bind(crypto.randomUUID(), childId, definition.key, sessionId, completedAt),
    ]),
  };
}

async function unlockD1SecretBadge(
  db: D1Database,
  params: {
    childId: string;
    sessionId: string;
    completedAt: string;
    badgeKey: string;
  },
) {
  const definitionRaw = await db
    .prepare(
      `
      SELECT key, family, name, icon_path, is_secret, condition_json
      FROM badge_definitions
      WHERE key = ?
      LIMIT 1
    `,
    )
    .bind(params.badgeKey)
    .first<D1BadgeDefinitionRow>();

  if (!definitionRaw) {
    return { unlockedBadge: null as UnlockedBadge | null, statements: [] as D1PreparedStatement[] };
  }

  const result = await insertD1UnlockedBadges(db, {
    childId: params.childId,
    sessionId: params.sessionId,
    completedAt: params.completedAt,
    definitions: [normalizeBadgeDefinition(definitionRaw)],
    latestProgress: 1,
  });

  return {
    unlockedBadge: result.unlockedBadges[0] ?? null,
    statements: result.statements,
  };
}

async function insertUnlockedBadges(
  supabase: SupabaseClient,
  params: {
    childId: string;
    sessionId: string;
    completedAt: string;
    definitions: BadgeDefinitionRow[];
    latestProgress: number;
  },
) {
  const { childId, sessionId, completedAt, definitions, latestProgress } = params;
  if (definitions.length === 0) return [];

  const candidateKeys = definitions.map((definition) => definition.key);
  const { data: existingRows, error: existingError } = await supabase
    .from('child_badges')
    .select('badge_key')
    .eq('child_id', childId)
    .in('badge_key', candidateKeys);

  if (existingError) throw existingError;

  const existingKeys = new Set(((existingRows ?? []) as Array<{ badge_key: string }>).map((row) => row.badge_key));
  const newDefinitions = definitions.filter((definition) => !existingKeys.has(definition.key));
  if (newDefinitions.length === 0) return [];

  const badgeRows = newDefinitions.map((definition) => ({
    child_id: childId,
    badge_key: definition.key,
    unlocked_at: completedAt,
    session_id: sessionId,
    latest_progress: latestProgress,
  }));

  const { error: badgeInsertError } = await supabase.from('child_badges').insert(badgeRows);
  if (badgeInsertError) throw badgeInsertError;

  const eventRows = newDefinitions.map((definition) => ({
    child_id: childId,
    badge_key: definition.key,
    session_id: sessionId,
    created_at: completedAt,
  }));

  const { error: eventInsertError } = await supabase.from('badge_unlock_events').insert(eventRows);
  if (eventInsertError) throw eventInsertError;

  return newDefinitions.map(toUnlockedBadge);
}

async function unlockSecretBadge(
  supabase: SupabaseClient,
  params: {
    childId: string;
    sessionId: string;
    completedAt: string;
    badgeKey: string;
  },
) {
  const { data: definitionRaw, error: definitionError } = await supabase
    .from('badge_definitions')
    .select('key, family, name, icon_path, is_secret, condition_json')
    .eq('key', params.badgeKey)
    .maybeSingle();

  if (definitionError) throw definitionError;
  if (!definitionRaw) return null;

  const [unlocked] = await insertUnlockedBadges(supabase, {
    childId: params.childId,
    sessionId: params.sessionId,
    completedAt: params.completedAt,
    definitions: [definitionRaw as BadgeDefinitionRow],
    latestProgress: 1,
  });

  return unlocked ?? null;
}

export async function completeStudySessionInD1(
  db: D1Database,
  params: CompleteStudySessionParams,
): Promise<CompleteStudySessionServiceResult> {
  const currentSessionPerfect = params.totalQuestions > 0 && params.correctCount === params.totalQuestions;
  const weekKey = getIsoWeekKey(params.completedDateJst);
  const now = new Date().toISOString();
  const sessionId = crypto.randomUUID();

  const previousSession = await db
    .prepare(
      `
      SELECT total_questions, correct_count, started_at, completed_at
      FROM study_sessions
      WHERE child_id = ?
      ORDER BY COALESCE(completed_at, started_at) DESC, id DESC
      LIMIT 1
    `,
    )
    .bind(params.childId)
    .first<D1StudySessionRow>();

  const previousStudiedDate = previousSession
    ? new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date(previousSession.completed_at ?? previousSession.started_at))
    : null;
  const previousSessionPerfect = previousSession
    ? previousSession.total_questions > 0 && previousSession.correct_count === previousSession.total_questions
    : null;

  const child = await db
    .prepare('SELECT total_points FROM child_profiles WHERE id = ? LIMIT 1')
    .bind(params.childId)
    .first<{ total_points: number }>();
  if (!child) {
    throw new Error('Child profile not found');
  }

  const currentTotalPoints = Number(child.total_points ?? 0);
  const totalPoints = currentTotalPoints + Math.max(0, params.earnedPoints);

  const streakState = await db
    .prepare(
      `
      SELECT current_streak_days, longest_streak_days, last_studied_date, weekly_shield_count, shield_week_key
      FROM child_streak_state
      WHERE child_id = ?
      LIMIT 1
    `,
    )
    .bind(params.childId)
    .first<StreakState>();

  let currentStreakDays = Number(streakState?.current_streak_days ?? 0);
  let longestStreakDays = Number(streakState?.longest_streak_days ?? 0);
  let weeklyShieldCount = Number(streakState?.weekly_shield_count ?? 1);
  let shieldWeekKey = streakState?.shield_week_key ?? weekKey;

  if (shieldWeekKey !== weekKey) {
    weeklyShieldCount = 1;
    shieldWeekKey = weekKey;
  }

  if (!streakState?.last_studied_date) {
    currentStreakDays = 1;
  } else {
    const diff = dayDiff(params.completedDateJst, streakState.last_studied_date);
    if (diff === 1) {
      currentStreakDays += 1;
    } else if (diff > 1 && weeklyShieldCount > 0) {
      currentStreakDays += 1;
      weeklyShieldCount -= 1;
    } else {
      currentStreakDays = 1;
    }
  }

  if (currentStreakDays > longestStreakDays) {
    longestStreakDays = currentStreakDays;
  }

  const nextLastStudiedDate =
    !streakState?.last_studied_date || params.completedDateJst > streakState.last_studied_date
      ? params.completedDateJst
      : streakState.last_studied_date;

  const stats = await db
    .prepare(
      `
      SELECT perfect_session_count, genre_explorer_count
      FROM child_learning_stats
      WHERE child_id = ?
      LIMIT 1
    `,
    )
    .bind(params.childId)
    .first<LearningStats>();

  let perfectSessionCount = Number(stats?.perfect_session_count ?? 0);
  let genreExplorerCount = Number(stats?.genre_explorer_count ?? 0);

  if (currentSessionPerfect) {
    perfectSessionCount += 1;
  }

  const existingGenreProgress = await db
    .prepare('SELECT child_id FROM child_genre_progress WHERE child_id = ? AND genre_id = ? LIMIT 1')
    .bind(params.childId, params.genreId)
    .first<{ child_id: string }>();
  const isFirstGenreSession = !existingGenreProgress;
  if (isFirstGenreSession) {
    genreExplorerCount += 1;
  }

  const genre = await db
    .prepare('SELECT id, parent_id FROM genres WHERE id = ? LIMIT 1')
    .bind(params.genreId)
    .first<{ id: string; parent_id: string | null }>();
  const subjectKey = genre?.parent_id ?? genre?.id ?? params.genreId;

  let subjectSessionCount = 0;
  if (subjectKey) {
    const subjectStats = await db
      .prepare('SELECT session_count FROM child_subject_stats WHERE child_id = ? AND subject_id = ? LIMIT 1')
      .bind(params.childId, subjectKey)
      .first<{ session_count: number }>();
    subjectSessionCount = Number(subjectStats?.session_count ?? 0) + 1;
  }

  const badgeDefinitionsResult = await db
    .prepare(
      `
      SELECT key, family, name, icon_path, is_secret, condition_json
      FROM badge_definitions
      WHERE is_active = 1
    `,
    )
    .all<D1BadgeDefinitionRow>();
  const badgeDefinitions = (badgeDefinitionsResult.results ?? []).map(normalizeBadgeDefinition);
  const unlockedBadges: UnlockedBadge[] = [];
  const badgeStatements: D1PreparedStatement[] = [];

  const unlockFamily = async (
    family: string,
    latestProgress: number,
    predicate: (definition: BadgeDefinitionRow) => boolean,
  ) => {
    const definitions = badgeDefinitions.filter(
      (definition) => definition.family === family && !definition.is_secret && predicate(definition),
    );
    const result = await insertD1UnlockedBadges(db, {
      childId: params.childId,
      sessionId,
      completedAt: params.completedAt,
      definitions,
      latestProgress,
    });
    unlockedBadges.push(...result.unlockedBadges);
    badgeStatements.push(...result.statements);
  };

  await unlockFamily('streak_days', currentStreakDays, (definition) => thresholdOf(definition) <= currentStreakDays);
  await unlockFamily('perfect_sessions', perfectSessionCount, (definition) => thresholdOf(definition) <= perfectSessionCount);
  await unlockFamily('genre_explorer', genreExplorerCount, (definition) => thresholdOf(definition) <= genreExplorerCount);
  await unlockFamily('total_points', totalPoints, (definition) => thresholdOf(definition) <= totalPoints);
  await unlockFamily(
    'subject_master',
    subjectSessionCount,
    (definition) => definition.condition_json?.subject_id === subjectKey && thresholdOf(definition) <= subjectSessionCount,
  );

  if (previousStudiedDate && dayDiff(params.completedDateJst, previousStudiedDate) >= 3) {
    const result = await unlockD1SecretBadge(db, {
      childId: params.childId,
      sessionId,
      completedAt: params.completedAt,
      badgeKey: 'secret_comeback',
    });
    if (result.unlockedBadge) unlockedBadges.push(result.unlockedBadge);
    badgeStatements.push(...result.statements);
  }

  if (currentSessionPerfect && previousSessionPerfect === false) {
    const result = await unlockD1SecretBadge(db, {
      childId: params.childId,
      sessionId,
      completedAt: params.completedAt,
      badgeKey: 'secret_perfect_recovery',
    });
    if (result.unlockedBadge) unlockedBadges.push(result.unlockedBadge);
    badgeStatements.push(...result.statements);
  }

  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        `
        INSERT INTO study_sessions (
          id, child_id, genre_id, mode, total_questions, correct_count, earned_points, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      )
      .bind(
        sessionId,
        params.childId,
        params.genreId,
        params.mode,
        params.totalQuestions,
        params.correctCount,
        params.earnedPoints,
        params.completedAt,
      ),
    ...params.historyRecords.map((record) =>
      db
        .prepare(
          `
          INSERT INTO study_history (
            id, session_id, child_id, question_id, is_correct, selected_index, answered_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        )
        .bind(
          crypto.randomUUID(),
          sessionId,
          params.childId,
          record.question_id,
          asSqlBoolean(record.is_correct),
          record.selected_index,
          params.completedAt,
        ),
    ),
    ...params.pointTransactions
      .filter((transaction) => transaction.points > 0)
      .map((transaction) =>
        db
          .prepare(
            `
            INSERT INTO point_transactions (
              id, child_id, session_id, points, reason, created_at
            ) VALUES (?, ?, ?, ?, ?, ?)
          `,
          )
          .bind(crypto.randomUUID(), params.childId, sessionId, transaction.points, transaction.reason, params.completedAt),
      ),
    db
      .prepare('UPDATE child_profiles SET total_points = ?, updated_at = ? WHERE id = ?')
      .bind(totalPoints, now, params.childId),
    db
      .prepare(
        `
        INSERT INTO child_streak_state (
          child_id, current_streak_days, longest_streak_days, last_studied_date,
          weekly_shield_count, shield_week_key, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(child_id) DO UPDATE SET
          current_streak_days = excluded.current_streak_days,
          longest_streak_days = excluded.longest_streak_days,
          last_studied_date = excluded.last_studied_date,
          weekly_shield_count = excluded.weekly_shield_count,
          shield_week_key = excluded.shield_week_key,
          updated_at = excluded.updated_at
      `,
      )
      .bind(params.childId, currentStreakDays, longestStreakDays, nextLastStudiedDate, weeklyShieldCount, shieldWeekKey, now),
    db
      .prepare(
        `
        INSERT INTO child_learning_stats (
          child_id, perfect_session_count, genre_explorer_count, updated_at
        ) VALUES (?, ?, ?, ?)
        ON CONFLICT(child_id) DO UPDATE SET
          perfect_session_count = excluded.perfect_session_count,
          genre_explorer_count = excluded.genre_explorer_count,
          updated_at = excluded.updated_at
      `,
      )
      .bind(params.childId, perfectSessionCount, genreExplorerCount, now),
  ];

  if (isFirstGenreSession) {
    statements.push(
      db
        .prepare(
          `
          INSERT OR IGNORE INTO child_genre_progress (
            child_id, genre_id, first_session_id, first_completed_at
          ) VALUES (?, ?, ?, ?)
        `,
        )
        .bind(params.childId, params.genreId, sessionId, params.completedAt),
    );
  }

  if (subjectKey) {
    statements.push(
      db
        .prepare(
          `
          INSERT INTO child_subject_stats (
            child_id, subject_id, session_count, updated_at
          ) VALUES (?, ?, ?, ?)
          ON CONFLICT(child_id, subject_id) DO UPDATE SET
            session_count = excluded.session_count,
            updated_at = excluded.updated_at
        `,
        )
        .bind(params.childId, subjectKey, subjectSessionCount, now),
    );
  }

  statements.push(...badgeStatements);
  await db.batch(statements);

  return { sessionId, unlockedBadges };
}

export async function completeStudySessionInAppLayer(
  supabase: SupabaseClient,
  params: CompleteStudySessionParams,
): Promise<CompleteStudySessionServiceResult> {
  const currentSessionPerfect = params.totalQuestions > 0 && params.correctCount === params.totalQuestions;
  const weekKey = getIsoWeekKey(params.completedDateJst);

  const { data: previousSessionRaw, error: previousSessionError } = await supabase
    .from('study_sessions')
    .select('total_questions, correct_count, started_at, completed_at')
    .eq('child_id', params.childId)
    .order('completed_at', { ascending: false, nullsFirst: false })
    .order('started_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (previousSessionError) throw previousSessionError;

  const previousSession = previousSessionRaw as {
    total_questions: number;
    correct_count: number;
    started_at: string;
    completed_at: string | null;
  } | null;
  const previousStudiedDate = previousSession
    ? new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date(previousSession.completed_at ?? previousSession.started_at))
    : null;
  const previousSessionPerfect = previousSession
    ? previousSession.total_questions > 0 && previousSession.correct_count === previousSession.total_questions
    : null;

  const { data: sessionRaw, error: sessionInsertError } = await supabase
    .from('study_sessions')
    .insert({
      child_id: params.childId,
      genre_id: params.genreId,
      mode: params.mode,
      total_questions: params.totalQuestions,
      correct_count: params.correctCount,
      earned_points: params.earnedPoints,
      completed_at: params.completedAt,
    })
    .select('id')
    .single();

  if (sessionInsertError || !sessionRaw) throw sessionInsertError ?? new Error('Failed to create study session');
  const sessionId = (sessionRaw as { id: string }).id;

  if (params.historyRecords.length > 0) {
    const { error } = await supabase.from('study_history').insert(
      params.historyRecords.map((record) => ({
        session_id: sessionId,
        child_id: params.childId,
        question_id: record.question_id,
        is_correct: record.is_correct,
        selected_index: record.selected_index,
      })),
    );
    if (error) throw error;
  }

  if (params.pointTransactions.length > 0) {
    const { error } = await supabase.from('point_transactions').insert(
      params.pointTransactions
        .filter((transaction) => transaction.points > 0)
        .map((transaction) => ({
          child_id: params.childId,
          session_id: sessionId,
          points: transaction.points,
          reason: transaction.reason,
        })),
    );
    if (error) throw error;
  }

  let totalPoints = 0;
  const { data: childRaw, error: childReadError } = await supabase
    .from('child_profiles')
    .select('total_points')
    .eq('id', params.childId)
    .single();
  if (childReadError || !childRaw) throw childReadError ?? new Error('Child profile not found');

  const currentTotalPoints = Number((childRaw as { total_points: number }).total_points ?? 0);
  if (params.earnedPoints > 0) {
    totalPoints = currentTotalPoints + params.earnedPoints;
    const { error: totalUpdateError } = await supabase
      .from('child_profiles')
      .update({ total_points: totalPoints })
      .eq('id', params.childId);
    if (totalUpdateError) throw totalUpdateError;
  } else {
    totalPoints = currentTotalPoints;
  }

  const { error: initialStreakUpsertError } = await supabase
    .from('child_streak_state')
    .upsert({
      child_id: params.childId,
      current_streak_days: 0,
      longest_streak_days: 0,
      weekly_shield_count: 1,
      shield_week_key: weekKey,
    }, { onConflict: 'child_id', ignoreDuplicates: true });
  if (initialStreakUpsertError) throw initialStreakUpsertError;

  const { data: streakRaw, error: streakReadError } = await supabase
    .from('child_streak_state')
    .select('current_streak_days, longest_streak_days, last_studied_date, weekly_shield_count, shield_week_key')
    .eq('child_id', params.childId)
    .single();

  if (streakReadError || !streakRaw) throw streakReadError ?? new Error('Streak state not found');
  const streakState = streakRaw as StreakState;

  let currentStreakDays = Number(streakState.current_streak_days ?? 0);
  let longestStreakDays = Number(streakState.longest_streak_days ?? 0);
  let weeklyShieldCount = Number(streakState.weekly_shield_count ?? 1);
  let shieldWeekKey = streakState.shield_week_key;

  if (shieldWeekKey !== weekKey) {
    weeklyShieldCount = 1;
    shieldWeekKey = weekKey;
  }

  if (!streakState.last_studied_date) {
    currentStreakDays = 1;
  } else {
    const diff = dayDiff(params.completedDateJst, streakState.last_studied_date);
    if (diff === 1) {
      currentStreakDays += 1;
    } else if (diff > 1 && weeklyShieldCount > 0) {
      currentStreakDays += 1;
      weeklyShieldCount -= 1;
    } else {
      currentStreakDays = 1;
    }
  }

  if (currentStreakDays > longestStreakDays) {
    longestStreakDays = currentStreakDays;
  }

  const nextLastStudiedDate =
    !streakState.last_studied_date || params.completedDateJst > streakState.last_studied_date
      ? params.completedDateJst
      : streakState.last_studied_date;

  const { error: streakUpdateError } = await supabase
    .from('child_streak_state')
    .update({
      current_streak_days: currentStreakDays,
      longest_streak_days: longestStreakDays,
      last_studied_date: nextLastStudiedDate,
      weekly_shield_count: weeklyShieldCount,
      shield_week_key: shieldWeekKey,
      updated_at: new Date().toISOString(),
    })
    .eq('child_id', params.childId);
  if (streakUpdateError) throw streakUpdateError;

  const { error: initialStatsUpsertError } = await supabase
    .from('child_learning_stats')
    .upsert({
      child_id: params.childId,
      perfect_session_count: 0,
      genre_explorer_count: 0,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'child_id', ignoreDuplicates: true });
  if (initialStatsUpsertError) throw initialStatsUpsertError;

  const { data: statsRaw, error: statsReadError } = await supabase
    .from('child_learning_stats')
    .select('perfect_session_count, genre_explorer_count')
    .eq('child_id', params.childId)
    .single();
  if (statsReadError || !statsRaw) throw statsReadError ?? new Error('Learning stats not found');

  const stats = statsRaw as LearningStats;
  let perfectSessionCount = Number(stats.perfect_session_count ?? 0);
  let genreExplorerCount = Number(stats.genre_explorer_count ?? 0);

  if (currentSessionPerfect) {
    perfectSessionCount += 1;
  }

  const { data: existingGenreProgress, error: genreProgressReadError } = await supabase
    .from('child_genre_progress')
    .select('child_id')
    .eq('child_id', params.childId)
    .eq('genre_id', params.genreId)
    .maybeSingle();
  if (genreProgressReadError) throw genreProgressReadError;

  if (!existingGenreProgress) {
    const { error } = await supabase.from('child_genre_progress').insert({
      child_id: params.childId,
      genre_id: params.genreId,
      first_session_id: sessionId,
      first_completed_at: params.completedAt,
    });
    if (error) throw error;
    genreExplorerCount += 1;
  }

  const { error: statsUpdateError } = await supabase
    .from('child_learning_stats')
    .update({
      perfect_session_count: perfectSessionCount,
      genre_explorer_count: genreExplorerCount,
      updated_at: new Date().toISOString(),
    })
    .eq('child_id', params.childId);
  if (statsUpdateError) throw statsUpdateError;

  const { data: genreRaw, error: genreReadError } = await supabase
    .from('genres')
    .select('id, parent_id')
    .eq('id', params.genreId)
    .maybeSingle();
  if (genreReadError) throw genreReadError;

  const genre = genreRaw as { id: string; parent_id: string | null } | null;
  const subjectKey = genre?.parent_id ?? genre?.id ?? params.genreId;

  let subjectSessionCount = 0;
  if (subjectKey) {
    const { data: subjectStatsRaw, error: subjectStatsReadError } = await supabase
      .from('child_subject_stats')
      .select('session_count')
      .eq('child_id', params.childId)
      .eq('subject_id', subjectKey)
      .maybeSingle();
    if (subjectStatsReadError) throw subjectStatsReadError;
    subjectSessionCount = Number((subjectStatsRaw as { session_count?: number } | null)?.session_count ?? 0) + 1;

    const { error } = await supabase.from('child_subject_stats').upsert({
      child_id: params.childId,
      subject_id: subjectKey,
      session_count: subjectSessionCount,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'child_id,subject_id' });
    if (error) throw error;
  }

  const { data: badgeDefinitionsRaw, error: badgeDefinitionsError } = await supabase
    .from('badge_definitions')
    .select('key, family, name, icon_path, is_secret, condition_json')
    .eq('is_active', true);
  if (badgeDefinitionsError) throw badgeDefinitionsError;

  const badgeDefinitions = (badgeDefinitionsRaw ?? []) as BadgeDefinitionRow[];
  const unlockedBadges: UnlockedBadge[] = [];

  const unlockFamily = async (family: string, latestProgress: number, predicate: (definition: BadgeDefinitionRow) => boolean) => {
    const definitions = badgeDefinitions.filter(
      (definition) => definition.family === family && !definition.is_secret && predicate(definition),
    );
    const unlocked = await insertUnlockedBadges(supabase, {
      childId: params.childId,
      sessionId,
      completedAt: params.completedAt,
      definitions,
      latestProgress,
    });
    unlockedBadges.push(...unlocked);
  };

  await unlockFamily('streak_days', currentStreakDays, (definition) => thresholdOf(definition) <= currentStreakDays);
  await unlockFamily('perfect_sessions', perfectSessionCount, (definition) => thresholdOf(definition) <= perfectSessionCount);
  await unlockFamily('genre_explorer', genreExplorerCount, (definition) => thresholdOf(definition) <= genreExplorerCount);
  await unlockFamily('total_points', totalPoints, (definition) => thresholdOf(definition) <= totalPoints);
  await unlockFamily(
    'subject_master',
    subjectSessionCount,
    (definition) => definition.condition_json?.subject_id === subjectKey && thresholdOf(definition) <= subjectSessionCount,
  );

  if (previousStudiedDate && dayDiff(params.completedDateJst, previousStudiedDate) >= 3) {
    const unlocked = await unlockSecretBadge(supabase, {
      childId: params.childId,
      sessionId,
      completedAt: params.completedAt,
      badgeKey: 'secret_comeback',
    });
    if (unlocked) unlockedBadges.push(unlocked);
  }

  if (currentSessionPerfect && previousSessionPerfect === false) {
    const unlocked = await unlockSecretBadge(supabase, {
      childId: params.childId,
      sessionId,
      completedAt: params.completedAt,
      badgeKey: 'secret_perfect_recovery',
    });
    if (unlocked) unlockedBadges.push(unlocked);
  }

  return { sessionId, unlockedBadges };
}
