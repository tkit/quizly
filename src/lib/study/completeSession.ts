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
