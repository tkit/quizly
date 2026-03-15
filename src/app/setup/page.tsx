import { Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import SetupClient from './SetupClient';

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

  return (
    <div className="flex min-h-screen flex-col items-center p-8 bg-zinc-50 dark:bg-zinc-950">
      <main className="w-full max-w-2xl flex flex-col gap-8 flex-1">
        <SetupClient genre={genre} />
      </main>
    </div>
  );
}
