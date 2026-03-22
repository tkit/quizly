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

const STORAGE_KEY = 'quizly_dashboard_snapshot';
const SNAPSHOT_TTL_MS = 1000 * 60 * 5;

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
  childId,
}: {
  accessToken: string;
  childId?: string;
}) {
  const response = await fetch('/api/dashboard/snapshot', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(childId ? { childId } : {}),
  });

  if (!response.ok) {
    return null;
  }

  const body = (await response.json().catch(() => null)) as {
    snapshot?: Omit<DashboardSnapshot, 'cachedAt'> | null;
  } | null;
  const snapshot = body?.snapshot ?? null;

  if (!snapshot) {
    return null;
  }

  writeDashboardSnapshot(snapshot);
  return snapshot;
}
