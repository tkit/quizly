'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronLeft } from 'lucide-react';

interface Genre {
  id: string;
  name: string;
  icon: string | null;
  color_hint: string | null;
}

export default function SetupClient({ genre }: { genre: Genre }) {
  const router = useRouter();
  const [mode, setMode] = useState<'normal' | 'review'>('normal');
  const [questionCount, setQuestionCount] = useState<number>(5);

  const targetColor =
    genre.color_hint === 'blue' ? 'blue' :
    genre.color_hint === 'orange' ? 'orange' :
    genre.color_hint === 'green' ? 'green' :
    genre.color_hint === 'pink' ? 'pink' :
    genre.color_hint === 'purple' ? 'purple' : 'zinc';

  const handleStart = () => {
    router.push(`/quiz?genre=${genre.id}&mode=${mode}&count=${questionCount}`);
  };

  return (
    <div className="flex flex-col gap-6 h-full flex-1 max-w-3xl mx-auto w-full p-4">
      {/* Playful Header */}
      <header className="flex items-center gap-4 bg-white p-4 rounded-[2rem] border-4 border-zinc-400 shadow-brutal-sm">
        <button 
          onClick={() => router.back()} 
          className="w-14 h-14 rounded-full bg-zinc-100 border-4 border-zinc-400 shadow-brutal flex items-center justify-center shrink-0 hover:bg-zinc-200 active-brutal-push focus:outline-none"
        >
          <ChevronLeft className="w-8 h-8 stroke-[3] text-zinc-700" />
        </button>
        <div className="flex items-center gap-3 bg-yellow-100 px-6 py-3 rounded-full border-4 border-zinc-400 shadow-brutal-sm ml-2">
          <span className="text-3xl animate-bounce-soft">{genre.icon}</span>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-800 tracking-wide">{genre.name}のせってい</h1>
        </div>
      </header>

      <div className="flex flex-col gap-8 bg-white p-6 sm:p-10 rounded-[3rem] border-4 border-zinc-400 shadow-brutal mt-4 relative">
        {/* Decorative corner element */}
        <div className={`absolute -right-4 -top-4 w-12 h-12 bg-${targetColor}-300 rounded-lg border-4 border-zinc-400 -rotate-12 z-10 shadow-brutal-sm`} />

        {/* モード選択 */}
        <section className="flex flex-col gap-4">
          <div className="bg-pink-100 border-4 border-zinc-400 shadow-brutal-sm px-6 py-2 rounded-full w-fit -rotate-1">
             <h2 className="text-xl sm:text-2xl font-black text-pink-700">どんな もんだいをやる？</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mt-2">
            <button 
              className={`text-left rounded-[2rem] border-4 border-zinc-400 shadow-brutal p-6 flex flex-col gap-4 items-center sm:items-start transition-all active-brutal-push focus:outline-none focus:ring-4 focus:ring-blue-400 ${
                mode === 'normal' 
                  ? `bg-${targetColor}-400 text-zinc-900 translate-y-[-4px] shadow-brutal-lg` 
                  : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-600'
              }`}
              onClick={() => setMode('normal')}
            >
              <div className={`text-5xl sm:text-6xl p-4 rounded-3xl border-4 border-zinc-400 shadow-brutal-sm bg-white ${mode === 'normal' ? 'animate-wiggle' : ''}`}>🎲</div>
              <div className="text-center sm:text-left">
                <h3 className="text-2xl sm:text-3xl font-black mb-1 tracking-wide">
                  すべてのもんだい
                </h3>
                <p className="text-lg font-bold opacity-80">ランダムに でるよ！</p>
              </div>
            </button>
            
            <button 
              className={`text-left rounded-[2rem] border-4 border-zinc-400 shadow-brutal p-6 flex flex-col gap-4 items-center sm:items-start transition-all active-brutal-push focus:outline-none focus:ring-4 focus:ring-blue-400 ${
                mode === 'review' 
                  ? `bg-${targetColor}-400 text-zinc-900 translate-y-[-4px] shadow-brutal-lg` 
                  : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-600'
              }`}
              onClick={() => setMode('review')}
            >
              <div className={`text-5xl sm:text-6xl p-4 rounded-3xl border-4 border-zinc-400 shadow-brutal-sm bg-white ${mode === 'review' ? 'animate-bounce-soft' : ''}`}>💪</div>
              <div className="text-center sm:text-left">
                <h3 className="text-2xl sm:text-3xl font-black mb-1 tracking-wide">
                  ニガテにちょうせん
                </h3>
                <p className="text-lg font-bold opacity-80">まちがえたもんだい！</p>
              </div>
            </button>
          </div>
        </section>

        <hr className="border-4 border-zinc-400 rounded-full my-2 opacity-10" />

        {/* 問題数選択 */}
        <section className="flex flex-col gap-4">
          <div className="bg-blue-100 border-4 border-zinc-400 shadow-brutal-sm px-6 py-2 rounded-full w-fit rotate-1">
             <h2 className="text-xl sm:text-2xl font-black text-blue-700">なんもん とく？</h2>
          </div>
          <div className="grid grid-cols-3 gap-4 mt-2">
            {[5, 10, 20].map((num) => (
              <button
                key={num}
                className={`h-20 sm:h-24 text-3xl sm:text-4xl rounded-[1.5rem] font-black border-4 border-zinc-400 shadow-brutal flex items-center justify-center transition-all active-brutal-push focus:outline-none focus:ring-4 focus:ring-blue-400 ${
                  questionCount === num 
                    ? `bg-${targetColor}-400 text-zinc-900 translate-y-[-4px] shadow-brutal-lg scale-105` 
                    : `bg-zinc-50 text-zinc-500 hover:bg-zinc-100`
                }`}
                onClick={() => setQuestionCount(num)}
              >
                {num}<span className="text-xl sm:text-2xl ml-1 leading-none mt-2">もん</span>
              </button>
            ))}
          </div>
        </section>

      </div>

      <div className="mt-8 pb-8">
        <button 
          className={`w-full h-24 sm:h-28 text-4xl sm:text-5xl font-black rounded-[2.5rem] border-4 border-zinc-400 shadow-brutal active-brutal-push transition-all text-zinc-900 focus:outline-none focus:ring-8 focus:ring-yellow-400/50 hover:-translate-y-2 hover:shadow-brutal-lg ${
            targetColor === 'blue' ? 'bg-blue-400 hover:bg-blue-500' :
            targetColor === 'orange' ? 'bg-orange-400 hover:bg-orange-500' :
            targetColor === 'green' ? 'bg-green-400 hover:bg-green-500' :
            targetColor === 'pink' ? 'bg-pink-400 hover:bg-pink-500' :
            targetColor === 'purple' ? 'bg-purple-400 hover:bg-purple-500' :
            'bg-yellow-400 hover:bg-yellow-500'
          }`}
          onClick={handleStart}
        >
          スタート！🚀
        </button>
      </div>
    </div>
  );
}
