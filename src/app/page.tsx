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
      <div className="flex min-h-screen items-center justify-center p-4 bg-red-50">
        <div className="bg-white p-6 rounded-2xl shadow-brutal border-4 border-red-500">
          <p className="text-red-600 font-bold text-lg">エラー：ユーザーをよみこめませんでした 😢</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center p-4 sm:p-8">
      <main className="flex w-full max-w-4xl flex-col items-center gap-8 pt-4 sm:pt-12">
        {/* Playful Title Banner */}
        <div className="relative w-full max-w-lg mx-auto text-center space-y-4 mb-4">
          <div className="absolute -top-6 -left-4 w-12 h-12 bg-yellow-300 rounded-full border-4 border-zinc-400 animate-wiggle z-0 shadow-brutal-sm" />
          <div className="absolute -bottom-4 -right-2 w-8 h-8 bg-pink-300 rounded-lg border-2 border-zinc-400 rotate-12 z-0" />
          
          <h1 className="relative z-10 text-5xl sm:text-7xl font-black tracking-widest text-blue-500 drop-shadow-[4px_4px_0_rgba(24,24,27,1)]">
            Quizly
          </h1>
          
          <div className="relative z-10 inline-block bg-white px-6 py-2 rounded-full border-4 border-zinc-400 shadow-brutal-sm transform -rotate-2">
            <p className="text-xl sm:text-2xl font-bold text-zinc-800">だれが がくしゅう する？</p>
          </div>
        </div>

        <div className="w-full bg-white/50 backdrop-blur-sm p-4 sm:p-8 rounded-[2rem] border-4 border-zinc-400 shadow-brutal">
          <LoginClient users={users || []} />
        </div>
      </main>
    </div>
  );
}
