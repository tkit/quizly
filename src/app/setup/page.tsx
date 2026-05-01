import { redirect } from 'next/navigation';
import MessageCard from '@/components/feedback/MessageCard';
import PageShell from '@/components/layout/PageShell';
import { getOptionalD1Database } from '@/lib/cloudflare/d1';

export const revalidate = 0;

export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ genre?: string }>;
}) {
  const d1 = await getOptionalD1Database();
  const resolvedParams = await searchParams;
  const genreId = resolvedParams.genre;

  if (!genreId) {
    return (
      <PageShell maxWidthClass="max-w-3xl" mainClassName="flex flex-1 items-center justify-center">
        <MessageCard
          title="ジャンルが指定されていません。"
          description="ダッシュボードからカテゴリを選んで開始してください。"
          actionLabel="ダッシュボードへ"
          actionHref="/dashboard"
          tone="error"
        />
      </PageShell>
    );
  }

  const genre = d1
    ? await d1
        .prepare(
          `
          SELECT id, name, parent_id
          FROM genres
          WHERE id = ?
          LIMIT 1
        `,
        )
        .bind(genreId)
        .first<{ id: string; name: string; parent_id: string | null }>()
    : null;

  if (!genre) {
    return (
      <PageShell maxWidthClass="max-w-3xl" mainClassName="flex flex-1 items-center justify-center">
        <MessageCard
          title="ジャンルの読み込みに失敗しました。"
          description="時間をおいて再度お試しください。"
          actionLabel="ダッシュボードへ"
          actionHref="/dashboard"
          tone="error"
        />
      </PageShell>
    );
  }

  if (genre.parent_id == null) {
    return (
      <PageShell maxWidthClass="max-w-3xl" mainClassName="flex flex-1 items-center justify-center">
        <MessageCard
          title="この画面ではサブカテゴリを選択してください。"
          description={`「${genre.name}」は教科（親カテゴリ）です。ダッシュボードでサブカテゴリを選んでから始めてください。`}
          actionLabel="ダッシュボードに戻る"
          actionHref="/dashboard"
          tone="warning"
        />
      </PageShell>
    );
  }

  redirect(`/quiz?genre=${genre.id}`);
}
