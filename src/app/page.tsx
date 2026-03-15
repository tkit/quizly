import { Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import LoginClient from './LoginClient';

// revalidate every 0 seconds to always fetch the latest users
export const revalidate = 0;

export default async function Home() {
  // Fetch users from Supabase
  const { data: users, error } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching users:', error);
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <p className="text-red-500">ユーザーの読み込みに失敗しました。</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center p-8 bg-zinc-50 dark:bg-zinc-950">
      <main className="flex w-full max-w-2xl flex-col items-center gap-8 pt-12">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-blue-600 dark:text-blue-400">Quizly</h1>
          <p className="text-xl text-zinc-600 dark:text-zinc-400">だれががくしゅうする？</p>
        </div>

        <LoginClient users={users || []} />
      </main>
    </div>
  );
}
