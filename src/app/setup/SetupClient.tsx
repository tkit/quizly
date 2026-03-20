'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Dices, Play, Target } from 'lucide-react';
import { GenreIcon } from '@/components/GenreIcon';
import { ICON_SIZE, ICON_STROKE } from '@/lib/ui/iconTokens';

interface Genre {
  id: string;
  name: string;
  icon_key: string;
  color_hint: string | null;
  parent_id: string | null;
}

export default function SetupClient({ genre }: { genre: Genre }) {
  const router = useRouter();
  const [mode, setMode] = useState<'normal' | 'review'>('normal');
  const [questionCount, setQuestionCount] = useState<number>(5);

  const tone =
    genre.color_hint === 'blue'
      ? {
          active: 'bg-blue-400 text-zinc-900',
          corner: 'bg-blue-300',
          cta: 'bg-blue-400 hover:bg-blue-500 text-zinc-900',
        }
      : genre.color_hint === 'orange'
        ? {
            active: 'bg-orange-400 text-zinc-900',
            corner: 'bg-orange-300',
            cta: 'bg-orange-400 hover:bg-orange-500 text-zinc-900',
          }
        : genre.color_hint === 'green'
          ? {
              active: 'bg-green-400 text-zinc-900',
              corner: 'bg-green-300',
              cta: 'bg-green-400 hover:bg-green-500 text-zinc-900',
            }
          : genre.color_hint === 'pink'
            ? {
                active: 'bg-pink-400 text-zinc-900',
                corner: 'bg-pink-300',
                cta: 'bg-pink-400 hover:bg-pink-500 text-zinc-900',
              }
            : genre.color_hint === 'purple'
              ? {
                  active: 'bg-purple-400 text-zinc-900',
                  corner: 'bg-purple-300',
                  cta: 'bg-purple-400 hover:bg-purple-500 text-zinc-900',
                }
              : {
                  active: 'bg-zinc-300 text-zinc-900',
                  corner: 'bg-zinc-300',
                  cta: 'bg-yellow-400 hover:bg-yellow-500 text-zinc-900',
                };

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
          <GenreIcon iconKey={genre.icon_key} className={`${ICON_SIZE.lg} animate-bounce-soft`} strokeWidth={ICON_STROKE.medium} />
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-800 tracking-wide">{genre.name}のせってい</h1>
        </div>
      </header>

      <div className="flex flex-col gap-8 bg-white p-6 sm:p-10 rounded-[3rem] border-4 border-zinc-400 shadow-brutal mt-4 relative">
        {/* Decorative corner element */}
        <div className={`absolute -right-4 -top-4 w-12 h-12 rounded-lg border-4 border-zinc-400 -rotate-12 z-10 shadow-brutal-sm ${tone.corner}`} />

        {/* モード選択 */}
        <section className="flex flex-col gap-4">
          <div className="bg-pink-100 border-4 border-zinc-400 shadow-brutal-sm px-6 py-2 rounded-full w-fit -rotate-1">
             <h2 className="text-xl sm:text-2xl font-black text-pink-700">どんな もんだいをやる？</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mt-2">
            <button 
              className={`text-left rounded-[2rem] border-4 border-zinc-400 shadow-brutal p-6 flex flex-col gap-4 items-center sm:items-start transition-all active-brutal-push focus:outline-none focus:ring-4 focus:ring-blue-400 ${
                mode === 'normal' 
                  ? `${tone.active} translate-y-[-4px] shadow-brutal-lg` 
                  : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-600'
              }`}
              onClick={() => setMode('normal')}
            >
              <div className={`p-4 rounded-3xl border-4 border-zinc-400 shadow-brutal-sm bg-white ${mode === 'normal' ? 'animate-wiggle' : ''}`}>
                <Dices className={`${ICON_SIZE.mode} text-zinc-700`} strokeWidth={ICON_STROKE.regular} />
              </div>
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
                  ? `${tone.active} translate-y-[-4px] shadow-brutal-lg` 
                  : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-600'
              }`}
              onClick={() => setMode('review')}
            >
              <div className={`p-4 rounded-3xl border-4 border-zinc-400 shadow-brutal-sm bg-white ${mode === 'review' ? 'animate-bounce-soft' : ''}`}>
                <Target className={`${ICON_SIZE.mode} text-zinc-700`} strokeWidth={ICON_STROKE.regular} />
              </div>
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
                    ? `${tone.active} translate-y-[-4px] shadow-brutal-lg scale-105` 
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
          className={`w-full h-24 sm:h-28 text-4xl sm:text-5xl font-black rounded-[2.5rem] border-4 border-zinc-400 shadow-brutal active-brutal-push transition-all focus:outline-none focus:ring-8 focus:ring-yellow-400/50 hover:-translate-y-2 hover:shadow-brutal-lg ${tone.cta} inline-flex items-center justify-center gap-3`}
          onClick={handleStart}
        >
          <Play className={ICON_SIZE.xl} strokeWidth={ICON_STROKE.medium} />
          スタート！
        </button>
      </div>
    </div>
  );
}
