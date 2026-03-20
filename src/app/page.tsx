import { supabase } from '@/lib/supabase';
import { CircleAlert } from 'lucide-react';
import LoginClient from './LoginClient';
import { ICON_SIZE, ICON_STROKE } from '@/lib/ui/iconTokens';
import QuizlyLogo from '@/components/QuizlyLogo';

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
          <p className="text-red-600 font-bold text-lg inline-flex items-center gap-2">
            <CircleAlert className={ICON_SIZE.md} strokeWidth={ICON_STROKE.regular} />
            エラー：ユーザーを読み込めませんでした
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center p-4 sm:p-8">
      <main className="flex w-full max-w-4xl flex-col items-center gap-8 pt-4 sm:pt-12">
        {/* Playful Title Banner */}
        <div className="relative w-full max-w-lg mx-auto text-center space-y-4 mb-4">
          <QuizlyLogo
            variant="horizontal"
            theme="light"
            priority
            className="relative z-10 mx-auto h-auto w-full max-w-[340px] sm:max-w-[460px]"
          />
          
          <div className="relative z-10 inline-block bg-white px-6 py-2 rounded-full border-4 border-zinc-400 shadow-brutal-sm transform -rotate-2">
            <p className="text-xl sm:text-2xl font-bold text-zinc-800">学習するユーザーを選択</p>
          </div>
        </div>

        <div className="w-full bg-white/50 backdrop-blur-sm p-4 sm:p-8 rounded-[2rem] border-4 border-zinc-400 shadow-brutal">
          <LoginClient users={users || []} />
        </div>
      </main>
    </div>
  );
}
