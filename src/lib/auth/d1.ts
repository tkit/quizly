import type { AppUser } from '@/lib/auth/server';

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
