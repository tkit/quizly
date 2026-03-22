import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClientWithToken, getUserFromBearerHeader } from '@/lib/auth/server';
import { ACTIVE_CHILD_COOKIE } from '@/lib/auth/constants';

type Body = {
  childId?: string;
};

type SessionRow = {
  genre_id: string | null;
  correct_count: number;
  total_questions: number;
};

function buildStudyStatusMap(sessions: SessionRow[]) {
  const statusMap: Record<string, 'unattempted' | 'studied_not_perfect' | 'perfect_cleared'> = {};

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

export async function POST(request: NextRequest) {
  const { user, accessToken } = await getUserFromBearerHeader(request.headers.get('authorization'));
  if (!user || !accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  const activeChildId = body.childId ?? request.cookies.get(ACTIVE_CHILD_COOKIE)?.value ?? null;

  if (!activeChildId) {
    return NextResponse.json({ snapshot: null });
  }

  const supabase = createServerSupabaseClientWithToken(accessToken);
  const [{ data: child }, { count: childCount }, { data: sessionsDataRaw }] = await Promise.all([
    supabase
      .from('child_profiles')
      .select('id, display_name, total_points')
      .eq('id', activeChildId)
      .single(),
    supabase.from('child_profiles').select('id', { count: 'exact', head: true }),
    supabase
      .from('study_sessions')
      .select('genre_id, correct_count, total_questions')
      .eq('child_id', activeChildId),
  ]);

  if (!child) {
    const response = NextResponse.json({ snapshot: null });
    response.cookies.set({
      name: ACTIVE_CHILD_COOKIE,
      value: '',
      maxAge: 0,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    });
    return response;
  }

  const snapshot = {
    activeChild: child,
    canSwitchChild: (childCount ?? 0) > 1,
    studyStatusByGenreId: buildStudyStatusMap((sessionsDataRaw ?? []) as SessionRow[]),
  };

  return NextResponse.json({ snapshot });
}
