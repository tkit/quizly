import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClientWithToken, getUserFromBearerHeader } from '@/lib/auth/server';

type QuestionDetails = {
  question_text: string;
  options: string[];
  correct_index: number;
  explanation: string | null;
};

type HistoryItem = {
  is_correct: boolean;
  selected_index: number;
  questions: QuestionDetails | QuestionDetails[] | null;
};

type Session = {
  id: string;
  genre_id: string;
  total_questions: number;
  correct_count: number;
  earned_points: number;
  mode: string;
  genres: {
    name: string;
    icon_key: string;
    color_hint: string;
  } | null;
};

export async function GET(request: NextRequest) {
  const { user, accessToken } = await getUserFromBearerHeader(request.headers.get('authorization'));
  if (!user || !accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sessionId = request.nextUrl.searchParams.get('session_id');
  if (!sessionId) {
    return NextResponse.json({ error: 'session_id is required' }, { status: 400 });
  }

  const supabase = createServerSupabaseClientWithToken(accessToken);

  const [{ data: sessionData, error: sessionError }, { data: historyData, error: historyError }] = await Promise.all([
    supabase
      .from('study_sessions')
      .select(
        `
        *,
        genres (
          name,
          icon_key,
          color_hint
        )
      `,
      )
      .eq('id', sessionId)
      .single(),
    supabase
      .from('study_history')
      .select(
        `
        is_correct,
        selected_index,
        questions (
          question_text,
          options,
          correct_index,
          explanation
        )
      `,
      )
      .eq('session_id', sessionId)
      .order('answered_at', { ascending: true }),
  ]);

  if (sessionError || !sessionData || historyError) {
    return NextResponse.json({ error: 'Failed to load result' }, { status: 500 });
  }

  return NextResponse.json({
    session: sessionData as Session,
    history: (historyData ?? []) as HistoryItem[],
  });
}
