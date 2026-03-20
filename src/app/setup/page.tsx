import { supabase } from '@/lib/supabase';
import { redirect } from 'next/navigation';

export const revalidate = 0;

export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ genre?: string }>;
}) {
  const resolvedParams = await searchParams;
  const genreId = resolvedParams.genre;

  if (!genreId) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 text-red-500">
        ジャンルが指定されていません。
      </div>
    );
  }

  // Fetch genre details
  const { data: genre, error } = await supabase
    .from('genres')
    .select('*')
    .eq('id', genreId)
    .single();

  if (error || !genre) {
    console.error('Error fetching genre:', error);
    return (
      <div className="flex min-h-screen items-center justify-center p-4 text-red-500">
        ジャンルの読み込みに失敗しました。
      </div>
    );
  }

  if (genre.parent_id == null) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center gap-6 bg-zinc-50 dark:bg-zinc-950">
        <div className="bg-white border-4 border-zinc-400 shadow-brutal rounded-[2rem] p-8 max-w-xl w-full">
          <p className="text-2xl font-black text-zinc-800 mb-3">この画面では サブカテゴリを えらんでね</p>
          <p className="text-lg font-bold text-zinc-600">
            「{genre.name}」は教科（親カテゴリ）です。ダッシュボードでサブカテゴリを選んでから始めてください。
          </p>
        </div>
        <a
          href="/dashboard"
          className="inline-flex items-center justify-center h-14 px-8 rounded-full border-4 border-zinc-400 bg-yellow-300 hover:bg-yellow-400 shadow-brutal font-black text-zinc-900"
        >
          ダッシュボードにもどる
        </a>
      </div>
    );
  }

  redirect(`/quiz?genre=${genre.id}`);
}
