import type { SupabaseClient, User } from '@supabase/supabase-js';

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

export type StudyStatus = 'unattempted' | 'studied_not_perfect' | 'perfect_cleared';

type SessionRow = {
  genre_id: string | null;
  correct_count: number;
  total_questions: number;
};

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

export function buildStudyStatusMap(sessions: SessionRow[]) {
  const statusMap: Record<string, StudyStatus> = {};

  for (const session of sessions) {
    if (!session.genre_id) continue;

    const isPerfect = session.total_questions > 0 && session.correct_count === session.total_questions;
    const current = statusMap[session.genre_id] ?? 'unattempted';

    if (isPerfect) {
      statusMap[session.genre_id] = 'perfect_cleared';
    } else if (current !== 'perfect_cleared') {
      statusMap[session.genre_id] = 'studied_not_perfect';
    }
  }

  return statusMap;
}

export async function getDashboardSnapshot(supabase: SupabaseClient, activeChildId: string) {
  const [{ data: child }, { count: childCount }, { data: sessionsDataRaw, error: sessionsError }] = await Promise.all([
    supabase
      .from('child_profiles')
      .select('id, display_name, total_points')
      .eq('id', activeChildId)
      .maybeSingle(),
    supabase.from('child_profiles').select('id', { count: 'exact', head: true }),
    supabase
      .from('study_sessions')
      .select('genre_id, correct_count, total_questions')
      .eq('child_id', activeChildId),
  ]);

  if (!child || sessionsError) {
    return null;
  }

  return {
    activeChild: child as DashboardActiveChild,
    canSwitchChild: (childCount ?? 0) > 1,
    studyStatusByGenreId: buildStudyStatusMap((sessionsDataRaw ?? []) as SessionRow[]),
  };
}

export async function getParentGateState(supabase: SupabaseClient, guardianId: string) {
  const [pinResult, verifyResult] = await Promise.all([
    supabase
      .from('guardian_accounts')
      .select('parent_pin_hash')
      .eq('id', guardianId)
      .single(),
    supabase
      .from('parent_reauth_challenges')
      .select('expires_at')
      .eq('guardian_id', guardianId)
      .gt('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (pinResult.error) {
    throw pinResult.error;
  }

  if (verifyResult.error) {
    throw verifyResult.error;
  }

  return {
    hasParentPin: Boolean(pinResult.data?.parent_pin_hash),
    unlocked: Boolean(verifyResult.data),
  };
}
