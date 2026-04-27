import type { AppUser } from '@/lib/auth/server';
import type {
  DashboardActiveChild,
  DashboardGenreWithQuestionCount,
  StudyStatus,
} from '@/lib/auth/data';

export type D1ChildProfile = {
  id: string;
  display_name: string;
  total_points: number;
  avatar_url: string | null;
};

export async function ensureD1GuardianProfile(db: D1Database, user: AppUser) {
  const fallbackName = user.displayName ?? user.email?.split('@')[0] ?? '保護者';

  await db
    .prepare(
      `
      INSERT INTO guardian_accounts (
        id, email, display_name, legacy_supabase_user_id, updated_at
      ) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        email = excluded.email,
        display_name = excluded.display_name,
        legacy_supabase_user_id = COALESCE(guardian_accounts.legacy_supabase_user_id, excluded.legacy_supabase_user_id),
        updated_at = excluded.updated_at
    `,
    )
    .bind(user.id, user.email, String(fallbackName), user.legacySupabaseUserId, new Date().toISOString())
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

export async function clearD1ParentReauthSession(db: D1Database, guardianId: string) {
  await db
    .prepare('DELETE FROM parent_reauth_challenges WHERE guardian_id = ?')
    .bind(guardianId)
    .run();
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
