import LoginClient from './LoginClient';
import QuizlyLogo from '@/components/QuizlyLogo';

export default function Home() {
  return (
    <div className="flex min-h-screen-safe flex-col items-center px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
      <main className="flex w-full max-w-4xl flex-col items-center gap-6 pt-2 sm:gap-8 sm:pt-8">
        {/* Playful Title Banner */}
        <div className="relative mx-auto mb-2 w-full max-w-lg space-y-3 text-center sm:mb-4 sm:space-y-4">
          <QuizlyLogo
            variant="horizontal"
            theme="light"
            priority
            className="relative z-10 mx-auto h-auto w-full max-w-[300px] sm:max-w-[390px] md:max-w-[460px]"
          />
          
          <div className="relative z-10 inline-block rounded-full border-4 border-zinc-400 bg-white px-4 py-2 shadow-brutal-sm transform -rotate-2 sm:px-6">
            <p className="text-[clamp(1rem,4.8vw,1.5rem)] font-bold text-zinc-800">学習するユーザーを選択</p>
          </div>
        </div>

        <div className="w-full rounded-[2rem] border-4 border-zinc-400 bg-white/50 p-4 shadow-brutal backdrop-blur-sm sm:p-7 md:p-8">
          <LoginClient users={[]} />
        </div>
      </main>
    </div>
  );
}
