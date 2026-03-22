import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import DashboardClient from './DashboardClient';
import MessageCard from '@/components/feedback/MessageCard';
import PageShell from '@/components/layout/PageShell';
import { ACTIVE_CHILD_COOKIE } from '@/lib/auth/constants';
import { getDashboardSnapshot } from '@/lib/auth/data';
import { getAuthenticatedUser } from '@/lib/auth/server';
import { createServerSupabaseClient } from '@/lib/auth/server';

type QuestionCountRow = {
  genre_id: string;
  question_count: number | string;
};

type GenreRow = {
  id: string;
  name: string;
  icon_key: string;
  description: string | null;
  color_hint: string | null;
  parent_id: string | null;
};

export const revalidate = 0;

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const initialActiveChildId = cookieStore.get(ACTIVE_CHILD_COOKIE)?.value ?? null;
  const { user } = await getAuthenticatedUser();

  if (!user || !initialActiveChildId) {
    redirect('/');
  }

  const supabase = await createServerSupabaseClient();
  await supabase.from('parent_reauth_challenges').delete().eq('guardian_id', user.id);
  const snapshot = await getDashboardSnapshot(supabase, initialActiveChildId);

  if (!snapshot) {
    redirect('/');
  }

  const [{ data: genres, error: genresError }, { data: questionCounts, error: questionCountsError }] = await Promise.all([
    supabase
      .from('genres')
      .select('*')
      .order('parent_id', { ascending: true, nullsFirst: true })
      .order('id', { ascending: true }),
    supabase.rpc('get_active_question_counts'),
  ]);

  if (genresError || questionCountsError) {
    return (
      <PageShell maxWidthClass="max-w-4xl" mainClassName="flex flex-1 items-center justify-center">
        <MessageCard
          title="ジャンル情報の読み込みに失敗しました。"
          description="時間をおいて再度お試しください。"
          actionLabel="トップへ戻る"
          actionHref="/"
          tone="error"
        />
      </PageShell>
    );
  }

  const questionCountByGenreId = ((questionCounts ?? []) as QuestionCountRow[]).reduce((acc: Record<string, number>, questionCount) => {
    acc[questionCount.genre_id] = Number(questionCount.question_count ?? 0);
    return acc;
  }, {});

  const genresWithQuestionCount = ((genres ?? []) as GenreRow[]).map((genre) => ({
    ...genre,
    question_count: questionCountByGenreId[genre.id] ?? 0,
  }));

  return (
    <PageShell maxWidthClass="max-w-4xl">
      <DashboardClient
        activeChild={snapshot.activeChild}
        canSwitchChild={snapshot.canSwitchChild}
        genres={genresWithQuestionCount}
        studyStatusByGenreId={snapshot.studyStatusByGenreId}
      />
    </PageShell>
  );
}
