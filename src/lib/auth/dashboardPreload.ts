import type { SupabaseClient } from '@supabase/supabase-js';

export type DashboardActiveChild = {
  id: string;
  display_name: string;
  total_points: number;
};

export type StudyStatus = 'unattempted' | 'studied_not_perfect' | 'perfect_cleared';

export type DashboardSnapshot = {
  activeChild: DashboardActiveChild;
  canSwitchChild: boolean;
  studyStatusByGenreId: Record<string, StudyStatus>;
  cachedAt: number;
};

type SessionRow = {
  genre_id: string | null;
  correct_count: number;
  total_questions: number;
};

type ChildLookup = {
  id: string;
  display_name: string;
  total_points: number;
};

const STORAGE_KEY = 'quizly_dashboard_snapshot';
const SNAPSHOT_TTL_MS = 1000 * 60 * 5;

function buildStudyStatusMap(sessions: SessionRow[]) {
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

export function readDashboardSnapshot(): DashboardSnapshot | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as DashboardSnapshot;
    if (!parsed.cachedAt || Date.now() - parsed.cachedAt > SNAPSHOT_TTL_MS) {
      window.sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function writeDashboardSnapshot(snapshot: Omit<DashboardSnapshot, 'cachedAt'>) {
  if (typeof window === 'undefined') return;

  window.sessionStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ...snapshot,
      cachedAt: Date.now(),
    } satisfies DashboardSnapshot),
  );
}

export function clearDashboardSnapshot() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(STORAGE_KEY);
}

export async function preloadDashboardSnapshot({
  accessToken,
  supabase,
  childId,
}: {
  accessToken: string;
  supabase: SupabaseClient;
  childId?: string;
}) {
  let activeChild: DashboardActiveChild | null = null;

  if (childId) {
    const { data: child } = await supabase
      .from('child_profiles')
      .select('id, display_name, total_points')
      .eq('id', childId)
      .single();

    activeChild = (child ?? null) as ChildLookup | null;
  } else {
    const currentChildResponse = await fetch('/api/session/child/current', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const currentChildBody = (await currentChildResponse.json().catch(() => null)) as { child?: DashboardActiveChild | null } | null;
    activeChild = currentChildBody?.child ?? null;
  }

  if (!activeChild) {
    return null;
  }

  const [{ count: childCount }, { data: sessionsDataRaw }] = await Promise.all([
    supabase.from('child_profiles').select('id', { count: 'exact', head: true }),
    supabase
      .from('study_sessions')
      .select('genre_id, correct_count, total_questions')
      .eq('child_id', activeChild.id),
  ]);

  const sessionsData = (sessionsDataRaw ?? []) as SessionRow[];
  const snapshot = {
    activeChild,
    canSwitchChild: (childCount ?? 0) > 1,
    studyStatusByGenreId: buildStudyStatusMap(sessionsData),
  };

  writeDashboardSnapshot(snapshot);
  return snapshot;
}
