import LoginClient from './LoginClient';
import QuizlyLogo from '@/components/QuizlyLogo';

export default function Home() {
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
          <LoginClient users={[]} />
        </div>
      </main>
    </div>
  );
}
