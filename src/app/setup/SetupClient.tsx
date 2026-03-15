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
    genre.color_hint === 'green' ? 'green' : 'zinc';

  const handleStart = () => {
    router.push(`/quiz?genre=${genre.id}&mode=${mode}&count=${questionCount}`);
  };

  return (
    <div className="flex flex-col gap-6 h-full flex-1">
      <header className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full w-12 h-12 shrink-0">
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <div className="flex items-center gap-3 bg-white px-6 py-3 rounded-full shadow-sm">
          <span className="text-2xl">{genre.icon}</span>
          <h1 className="text-xl font-bold">{genre.name}の設定</h1>
        </div>
      </header>

      <div className="flex flex-col gap-6 bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-zinc-100 mt-4">
        
        {/* モード選択 */}
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-bold text-zinc-700">どんな問題をやる？</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card 
              className={`cursor-pointer border-2 transition-all rounded-2xl ${
                mode === 'normal' ? `border-${targetColor}-500 bg-${targetColor}-50` : 'border-zinc-200 hover:border-zinc-300'
              }`}
              onClick={() => setMode('normal')}
            >
              <CardContent className="p-6 flex flex-col gap-2 items-center text-center">
                <div className="text-4xl mb-2">🎲</div>
                <h3 className={`text-xl font-bold ${mode === 'normal' ? `text-${targetColor}-700` : 'text-zinc-600'}`}>
                  すべてのもんだい
                </h3>
                <p className="text-sm text-zinc-500">ランダムに出だされるよ</p>
              </CardContent>
            </Card>
            
            <Card 
              className={`cursor-pointer border-2 transition-all rounded-2xl ${
                mode === 'review' ? `border-${targetColor}-500 bg-${targetColor}-50` : 'border-zinc-200 hover:border-zinc-300'
              }`}
              onClick={() => setMode('review')}
            >
              <CardContent className="p-6 flex flex-col gap-2 items-center text-center">
                <div className="text-4xl mb-2">💪</div>
                <h3 className={`text-xl font-bold ${mode === 'review' ? `text-${targetColor}-700` : 'text-zinc-600'}`}>
                  ニガテにちょうせん
                </h3>
                <p className="text-sm text-zinc-500">まちがえた問題が出るよ</p>
              </CardContent>
            </Card>
          </div>
        </section>

        <hr className="border-zinc-100 my-2" />

        {/* 問題数選択 */}
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-bold text-zinc-700">何問とく？</h2>
          <div className="grid grid-cols-3 gap-4">
            {[5, 10, 20].map((num) => (
              <Button
                key={num}
                variant={questionCount === num ? 'default' : 'outline'}
                className={`h-16 text-xl rounded-2xl font-bold border-2 ${
                  questionCount === num 
                    ? `bg-${targetColor}-600 hover:bg-${targetColor}-700 border-transparent text-white shadow-md` 
                    : `border-zinc-200 text-zinc-600 hover:bg-${targetColor}-50 hover:text-${targetColor}-600 hover:border-${targetColor}-200`
                }`}
                onClick={() => setQuestionCount(num)}
              >
                {num}問
              </Button>
            ))}
          </div>
        </section>

      </div>

      <div className="mt-auto pt-8">
        <Button 
          className={`w-full h-20 text-2xl font-bold rounded-full shadow-lg transition-transform hover:scale-[1.02] active:scale-95 text-white ${
            targetColor === 'blue' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-200' :
            targetColor === 'orange' ? 'bg-orange-500 hover:bg-orange-600 shadow-orange-200' :
            targetColor === 'green' ? 'bg-green-500 hover:bg-green-600 shadow-green-200' :
            'bg-zinc-800 hover:bg-zinc-900 shadow-zinc-200'
          }`}
          onClick={handleStart}
        >
          スタート！
        </Button>
      </div>
    </div>
  );
}
