import { Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import DashboardClient from './DashboardClient';
import { Card, CardContent } from '@/components/ui/card';

export const revalidate = 0;

export default async function DashboardPage() {
  const { data: genres, error } = await supabase
    .from('genres')
    .select('*')
    .order('id');

  if (error) {
    console.error('Error fetching genres:', error);
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <p className="text-red-500">ジャンルの読み込みに失敗しました。</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-50 dark:bg-zinc-950 px-4 py-8">
      <main className="w-full max-w-4xl flex flex-col gap-8">
        <DashboardClient genres={genres || []} />
      </main>
    </div>
  );
}
