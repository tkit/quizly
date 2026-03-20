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
      <div className="flex min-h-screen-safe items-center justify-center p-4 text-red-500">
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
      <div className="flex min-h-screen-safe items-center justify-center p-4 text-red-500">
        ジャンルの読み込みに失敗しました。
      </div>
    );
  }

  if (genre.parent_id == null) {
    return (
      <div className="flex min-h-screen-safe flex-col items-center justify-center gap-6 bg-zinc-50 p-6 text-center dark:bg-zinc-950">
        <div className="w-full max-w-xl rounded-[2rem] border-4 border-zinc-400 bg-white p-6 shadow-brutal sm:p-8">
          <p className="mb-3 text-[clamp(1.25rem,5vw,1.5rem)] font-black text-zinc-800">この画面ではサブカテゴリを選択してください。</p>
          <p className="text-base font-bold text-zinc-600 sm:text-lg">
            「{genre.name}」は教科（親カテゴリ）です。ダッシュボードでサブカテゴリを選んでから始めてください。
          </p>
        </div>
        <a
          href="/dashboard"
          className="inline-flex min-h-11 items-center justify-center rounded-full border-4 border-zinc-400 bg-teal-300 px-8 py-2 font-black text-zinc-900 shadow-brutal hover:bg-teal-400"
        >
          ダッシュボードに戻る
        </a>
      </div>
    );
  }

  redirect(`/quiz?genre=${genre.id}`);
}
