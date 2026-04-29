import type { AppUser } from '@/lib/auth/server';
import type {
  DashboardActiveChild,
  DashboardGenreWithQuestionCount,
  ParentGenre,
  ParentManagedChild,
  ParentManagementSnapshot,
  ParentSessionHistoryItem,
  ParentSessionSummary,
  StudyStatus,
} from '@/lib/auth/data';

export type D1ChildProfile = {
  id: string;
  display_name: string;
  total_points: number;
  avatar_url: string | null;
};

const PARENT_REAUTH_SESSION_TTL_SECONDS = 15 * 60;

type D1ParentSessionSummaryRow = ParentSessionSummary;

type D1ParentSessionHistoryRow = Omit<ParentSessionHistoryItem, 'is_correct' | 'options'> & {
  is_correct: number;
  options: string;
};

function getD1ChangedRows(result: D1Result<unknown>) {
  if (!result.meta || typeof result.meta !== 'object' || !('changes' in result.meta)) {
    return 0;
  }

  const changes = result.meta.changes;
  return typeof changes === 'number' ? changes : 0;
}

export async function ensureD1GuardianProfile(db: D1Database, user: AppUser) {
  const fallbackName = user.displayName ?? user.email?.split('@')[0] ?? '保護者';

  await db
    .prepare(
      `
      INSERT INTO guardian_accounts (
        id, email, display_name, updated_at
      ) VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        email = excluded.email,
        display_name = excluded.display_name,
        updated_at = excluded.updated_at
    `,
    )
    .bind(user.id, user.email, String(fallbackName), new Date().toISOString())
    .run();
}

export async function listD1ChildProfiles(db: D1Database, guardianId: string): Promise<D1ChildProfile[]> {
  const result = await db
    .prepare(
      `
      SELECT id, display_name, total_points, avatar_url
      FROM child_profiles
      WHERE guardian_id = ?
      ORDER BY created_at ASC
    `,
    )
    .bind(guardianId)
    .all<D1ChildProfile>();

  return result.results ?? [];
}

export async function getD1ChildProfile(db: D1Database, guardianId: string, childId: string) {
  return db
    .prepare(
      `
      SELECT id, display_name, total_points, avatar_url
      FROM child_profiles
      WHERE id = ? AND guardian_id = ?
      LIMIT 1
    `,
    )
    .bind(childId, guardianId)
    .first<D1ChildProfile>();
}

export async function createD1ChildProfile(
  db: D1Database,
  params: {
    guardianId: string;
    displayName: string;
    avatarUrl: string | null;
  },
) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db
    .prepare(
      `
      INSERT INTO child_profiles (
        id, guardian_id, display_name, avatar_url, auth_mode, pin_hash, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'none', NULL, ?, ?)
    `,
    )
    .bind(id, params.guardianId, params.displayName, params.avatarUrl, now, now)
    .run();

  return getD1ChildProfile(db, params.guardianId, id);
}

export async function updateD1ChildProfile(
  db: D1Database,
  params: {
    guardianId: string;
    childId: string;
    displayName: string;
  },
) {
  await db
    .prepare(
      `
      UPDATE child_profiles
      SET display_name = ?, updated_at = ?
      WHERE id = ? AND guardian_id = ?
    `,
    )
    .bind(params.displayName, new Date().toISOString(), params.childId, params.guardianId)
    .run();

  const child = await db
    .prepare(
      `
      SELECT id, display_name, total_points, avatar_url, created_at
      FROM child_profiles
      WHERE id = ? AND guardian_id = ?
      LIMIT 1
    `,
    )
    .bind(params.childId, params.guardianId)
    .first<D1ChildProfile & { created_at: string }>();

  return child;
}

export async function deleteD1ChildProfile(db: D1Database, guardianId: string, childId: string) {
  const result = await db
    .prepare('DELETE FROM child_profiles WHERE id = ? AND guardian_id = ?')
    .bind(childId, guardianId)
    .run();

  return getD1ChangedRows(result) > 0;
}

export async function clearD1ParentReauthSession(db: D1Database, guardianId: string) {
  await db
    .prepare('DELETE FROM parent_reauth_challenges WHERE guardian_id = ?')
    .bind(guardianId)
    .run();
}

export async function createD1ParentReauthSession(db: D1Database, guardianId: string) {
  const expiresAt = new Date(Date.now() + PARENT_REAUTH_SESSION_TTL_SECONDS * 1000).toISOString();

  await db
    .prepare(
      `
      INSERT INTO parent_reauth_challenges (guardian_id, expires_at)
      VALUES (?, ?)
    `,
    )
    .bind(guardianId, expiresAt)
    .run();

  return expiresAt;
}

export async function getD1ParentReauthSessionExpiresAt(db: D1Database, guardianId: string) {
  const row = await db
    .prepare(
      `
      SELECT expires_at
      FROM parent_reauth_challenges
      WHERE guardian_id = ? AND expires_at > ?
      ORDER BY expires_at DESC
      LIMIT 1
    `,
    )
    .bind(guardianId, new Date().toISOString())
    .first<{ expires_at: string }>();

  return row?.expires_at ?? null;
}

export async function isD1ParentUnlocked(db: D1Database, guardianId: string) {
  const expiresAt = await getD1ParentReauthSessionExpiresAt(db, guardianId);
  return Boolean(expiresAt);
}

export async function getD1ParentGateState(db: D1Database, guardianId: string) {
  const [guardian, expiresAt] = await Promise.all([
    db
      .prepare('SELECT parent_pin_hash FROM guardian_accounts WHERE id = ? LIMIT 1')
      .bind(guardianId)
      .first<{ parent_pin_hash: string | null }>(),
    getD1ParentReauthSessionExpiresAt(db, guardianId),
  ]);

  if (!guardian) {
    throw new Error('Guardian account not found');
  }

  return {
    hasParentPin: Boolean(guardian.parent_pin_hash),
    unlocked: Boolean(expiresAt),
  };
}

export async function getD1ParentPinHash(db: D1Database, guardianId: string) {
  const row = await db
    .prepare('SELECT parent_pin_hash FROM guardian_accounts WHERE id = ? LIMIT 1')
    .bind(guardianId)
    .first<{ parent_pin_hash: string | null }>();

  return row?.parent_pin_hash ?? null;
}

export async function setD1ParentPinHash(db: D1Database, guardianId: string, parentPinHash: string) {
  const result = await db
    .prepare(
      `
      UPDATE guardian_accounts
      SET parent_pin_hash = ?, updated_at = ?
      WHERE id = ?
    `,
    )
    .bind(parentPinHash, new Date().toISOString(), guardianId)
    .run();

  return getD1ChangedRows(result) > 0;
}

export async function deleteD1GuardianAccount(db: D1Database, guardianId: string) {
  const result = await db
    .prepare('DELETE FROM guardian_accounts WHERE id = ?')
    .bind(guardianId)
    .run();

  return getD1ChangedRows(result) > 0;
}

export async function getD1ParentManagementSnapshot(db: D1Database, guardianId: string): Promise<ParentManagementSnapshot> {
  const [childrenData, sessionsData, historyData, allGenresData] = await Promise.all([
    db
      .prepare(
        `
        SELECT id, display_name, total_points, avatar_url, created_at
        FROM child_profiles
        WHERE guardian_id = ?
        ORDER BY created_at ASC
      `,
      )
      .bind(guardianId)
      .all<Omit<ParentManagedChild, 'last_studied_at' | 'session_count'>>(),
    db
      .prepare(
        `
        SELECT
          ss.id,
          ss.child_id,
          ss.genre_id,
          ss.mode,
          ss.total_questions,
          ss.correct_count,
          ss.earned_points,
          ss.started_at,
          ss.completed_at,
          g.name AS genre_name,
          g.parent_id AS parent_genre_id,
          g.color_hint AS color_hint
        FROM study_sessions ss
        JOIN child_profiles cp ON cp.id = ss.child_id
        LEFT JOIN genres g ON g.id = ss.genre_id
        WHERE cp.guardian_id = ?
        ORDER BY COALESCE(ss.completed_at, ss.started_at) DESC
      `,
      )
      .bind(guardianId)
      .all<D1ParentSessionSummaryRow>(),
    db
      .prepare(
        `
        SELECT
          sh.session_id,
          sh.child_id,
          sh.question_id,
          sh.is_correct,
          sh.selected_index,
          sh.answered_at,
          q.question_text,
          q.options,
          q.correct_index,
          q.explanation
        FROM study_history sh
        JOIN child_profiles cp ON cp.id = sh.child_id
        JOIN questions q ON q.id = sh.question_id
        WHERE cp.guardian_id = ?
        ORDER BY sh.answered_at DESC
      `,
      )
      .bind(guardianId)
      .all<D1ParentSessionHistoryRow>(),
    db
      .prepare('SELECT id, name, parent_id FROM genres ORDER BY name ASC')
      .all<ParentGenre>(),
  ]);

  const sessions = sessionsData.results ?? [];
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

  const children = (childrenData.results ?? []).map((child) => {
    const stats = childStats.get(child.id);

    return {
      ...child,
      last_studied_at: stats?.lastStudiedAt ?? null,
      session_count: stats?.sessionCount ?? 0,
    } satisfies ParentManagedChild;
  });

  const historyItems = (historyData.results ?? []).map((item) => ({
    session_id: item.session_id,
    child_id: item.child_id,
    question_id: item.question_id,
    is_correct: Boolean(item.is_correct),
    selected_index: item.selected_index,
    answered_at: item.answered_at,
    question_text: item.question_text,
    options: JSON.parse(item.options) as string[],
    correct_index: item.correct_index,
    explanation: item.explanation,
  } satisfies ParentSessionHistoryItem));

  const allGenres = allGenresData.results ?? [];

  return {
    children,
    sessions,
    historyItems,
    parentGenres: allGenres.filter((genre) => genre.parent_id == null),
    leafGenres: allGenres.filter((genre) => genre.parent_id != null),
  };
}

export async function getD1DashboardSnapshot(
  db: D1Database,
  params: {
    guardianId: string;
    activeChildId: string;
  },
) {
  const [child, childCountRow, studySessionsResult] = await Promise.all([
    db
      .prepare(
        `
        SELECT id, display_name, total_points
        FROM child_profiles
        WHERE id = ? AND guardian_id = ?
        LIMIT 1
      `,
      )
      .bind(params.activeChildId, params.guardianId)
      .first<DashboardActiveChild>(),
    db
      .prepare('SELECT COUNT(*) AS count FROM child_profiles WHERE guardian_id = ?')
      .bind(params.guardianId)
      .first<{ count: number }>(),
    db
      .prepare(
        `
        SELECT genre_id, total_questions, correct_count
        FROM study_sessions
        WHERE child_id = ? AND genre_id IS NOT NULL
      `,
      )
      .bind(params.activeChildId)
      .all<{ genre_id: string | null; total_questions: number; correct_count: number }>(),
  ]);

  if (!child) {
    return null;
  }

  const studyStatusByGenreId = (studySessionsResult.results ?? []).reduce<Record<string, StudyStatus>>((acc, row) => {
    if (!row.genre_id) return acc;

    const current = acc[row.genre_id];
    const isPerfect = row.total_questions > 0 && row.correct_count === row.total_questions;
    if (isPerfect || !current) {
      acc[row.genre_id] = isPerfect ? 'perfect_cleared' : 'studied_not_perfect';
    }

    return acc;
  }, {});

  return {
    activeChild: child,
    canSwitchChild: Number(childCountRow?.count ?? 0) > 1,
    studyStatusByGenreId,
  };
}

export async function getD1DashboardGenreCatalog(db: D1Database): Promise<DashboardGenreWithQuestionCount[]> {
  const [genresResult, activeQuestionsResult] = await Promise.all([
    db
      .prepare(
        `
        SELECT id, name, icon_key, description, color_hint, parent_id
        FROM genres
        ORDER BY parent_id IS NOT NULL, parent_id, id
      `,
      )
      .all<Omit<DashboardGenreWithQuestionCount, 'question_count'>>(),
    db
      .prepare('SELECT genre_id FROM questions WHERE is_active = 1')
      .all<{ genre_id: string | null }>(),
  ]);

  const questionCountByGenreId = (activeQuestionsResult.results ?? []).reduce<Record<string, number>>((acc, row) => {
    if (!row.genre_id) return acc;
    acc[row.genre_id] = (acc[row.genre_id] ?? 0) + 1;
    return acc;
  }, {});

  return (genresResult.results ?? [])
    .map((genre) => ({
      ...genre,
      question_count: questionCountByGenreId[genre.id] ?? 0,
    }))
    .filter((genre) => {
      if (genre.parent_id == null) return true;
      return genre.question_count > 0;
    });
}

export async function getD1BadgeSummary(db: D1Database, childId: string) {
  const [streakState, badgeCountRow] = await Promise.all([
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
      .prepare('SELECT COUNT(*) AS count FROM child_badges WHERE child_id = ?')
      .bind(childId)
      .first<{ count: number }>(),
  ]);

  return {
    current_streak: Number(streakState?.current_streak_days ?? 0),
    unlocked_count: Number(badgeCountRow?.count ?? 0),
  };
}
