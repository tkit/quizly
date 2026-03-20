'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BadgeCheck, CheckCircle, Home, Medal, NotebookPen, RotateCcw, Sparkles, Star, ThumbsUp, Trophy, XCircle } from 'lucide-react';
import { POINTS_PER_CORRECT } from '@/lib/points';
import { fireResultEffect } from '@/lib/effects/confetti';
import { ICON_SIZE, ICON_STROKE } from '@/lib/ui/iconTokens';

interface QuestionDetails {
  question_text: string;
  options: string[];
  correct_index: number;
  explanation: string | null;
}

interface HistoryItem {
  is_correct: boolean;
  selected_index: number;
  questions: QuestionDetails | QuestionDetails[] | null;
}

interface Session {
  id: string;
  genre_id: string;
  total_questions: number;
  correct_count: number;
  earned_points: number;
  mode: string;
  genres: {
    name: string;
    icon_key: string;
    color_hint: string;
  } | null;
}

/**
 * Hook for animated count-up effect
 */
function useCountUp(target: number, duration: number = 1200) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (target <= 0) return;

    const startTime = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));

      if (progress >= 1) {
        clearInterval(timer);
        setCount(target);
      }
    }, 16);

    return () => clearInterval(timer);
  }, [target, duration]);

  return count;
}

export default function ResultClient({
  session,
  history,
}: {
  session: Session;
  history: HistoryItem[];
}) {
  const router = useRouter();

  const isPerfect = session.correct_count === session.total_questions;
  const isGood = session.correct_count >= session.total_questions * 0.8;
  const earnedPoints = session.earned_points || 0;
  const basePoints = session.correct_count * POINTS_PER_CORRECT;
  const bonusPoints = earnedPoints - basePoints;
  const ResultIcon = isPerfect ? Trophy : isGood ? Medal : ThumbsUp;

  const displayPoints = useCountUp(earnedPoints, 1500);
  const hasTriggeredResultEffect = useRef(false);

  useEffect(() => {
    if (earnedPoints <= 0 || hasTriggeredResultEffect.current) return;
    hasTriggeredResultEffect.current = true;
    void fireResultEffect({ isPerfect });
  }, [earnedPoints, isPerfect]);

  const retryButtonTone =
    session.genres?.color_hint === 'blue'
      ? 'bg-blue-400 hover:bg-blue-500 text-zinc-900'
      : session.genres?.color_hint === 'orange'
        ? 'bg-orange-400 hover:bg-orange-500 text-zinc-900'
        : session.genres?.color_hint === 'green'
          ? 'bg-green-400 hover:bg-green-500 text-zinc-900'
          : session.genres?.color_hint === 'pink'
            ? 'bg-pink-400 hover:bg-pink-500 text-zinc-900'
            : session.genres?.color_hint === 'purple'
              ? 'bg-purple-400 hover:bg-purple-500 text-zinc-900'
              : 'bg-zinc-800 hover:bg-zinc-900 text-white';

  return (
    <div className="flex flex-col gap-8 h-full max-w-3xl mx-auto w-full p-2 sm:p-4 pb-12">
      {/* Massive Result Banner */}
      <div className={`p-8 sm:p-12 rounded-[3.5rem] border-4 border-zinc-400 shadow-brutal-lg text-center relative overflow-hidden ${
        isPerfect 
          ? 'bg-yellow-300' 
          : isGood 
            ? 'bg-blue-300'
            : 'bg-zinc-100'
      }`}>
        {/* Background decorations */}
        <div className="absolute top-4 left-4 w-12 h-12 bg-white/40 rounded-full blur-sm" />
        <div className="absolute bottom-12 right-12 w-24 h-24 bg-white/30 rounded-full blur-md" />
        
        <div className="mb-4 animate-bounce drop-shadow-[4px_4px_0_rgba(24,24,27,1)] relative z-10 flex justify-center">
          <ResultIcon
            className={`${ICON_SIZE.hero} ${
              isPerfect ? 'text-amber-700' : isGood ? 'text-blue-700' : 'text-zinc-700'
            }`}
            strokeWidth={ICON_STROKE.medium}
          />
        </div>
        
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-black mb-4 text-zinc-900 drop-shadow-sm tracking-wide relative z-10">
          {isPerfect ? 'パーフェクト！！' : isGood ? 'すばらしい！' : 'よくがんばったね！'}
        </h1>
        
        <div className="inline-block bg-white px-8 py-3 rounded-full border-4 border-zinc-400 shadow-brutal mt-2 relative z-10 transform rotate-1">
          <p className="text-2xl sm:text-3xl font-black text-zinc-800">
             {session.total_questions}もん中 <span className={`text-5xl mx-2 ${isPerfect ? 'text-red-500 animate-pulse' : 'text-blue-600'}`}>{session.correct_count}</span> もんせいかい！
          </p>
        </div>

        {/* Points Display */}
        {earnedPoints > 0 && (
          <div className="mt-8 relative z-10 animate-points-pop">
            <div className="inline-flex flex-col items-center gap-2 bg-gradient-to-br from-amber-100 to-yellow-200 px-10 py-5 rounded-[2rem] border-4 border-amber-400 shadow-brutal transform -rotate-1">
              <div className="flex items-center gap-2">
                <Star className="w-8 h-8 text-amber-500 fill-amber-400 animate-spin-slow" />
                <span className="text-2xl sm:text-3xl font-black text-amber-800">ポイントゲット！</span>
                <Star className="w-8 h-8 text-amber-500 fill-amber-400 animate-spin-slow" />
              </div>
              <div className="text-5xl sm:text-7xl font-black text-amber-600 tabular-nums tracking-tight drop-shadow-[2px_2px_0_rgba(217,119,6,0.3)]">
                +{displayPoints}<span className="text-3xl sm:text-4xl ml-1">pt</span>
              </div>
              {isPerfect && bonusPoints > 0 && (
                <div className="bg-red-500 text-white px-4 py-1 rounded-full text-lg sm:text-xl font-black border-2 border-red-700 shadow-brutal-sm animate-bounce-soft transform rotate-2">
                  <span className="inline-flex items-center gap-2">
                    <BadgeCheck className={ICON_SIZE.sm} strokeWidth={ICON_STROKE.strong} />
                    パーフェクトボーナス ×1.5！ +{bonusPoints}pt
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row justify-center gap-4 mt-12 relative z-10">
          <button 
            className="h-16 px-8 rounded-full text-xl sm:text-2xl font-black bg-white border-4 border-zinc-400 shadow-brutal hover:bg-zinc-100 active-brutal-push focus:outline-none flex items-center justify-center gap-2"
            onClick={() => router.push('/dashboard')}
          >
            <Home className={ICON_SIZE.lg} strokeWidth={ICON_STROKE.bold} />
            トップへ
            <Sparkles className={`${ICON_SIZE.md} text-amber-500`} strokeWidth={ICON_STROKE.strong} />
          </button>
          <button
            className={`h-16 px-8 rounded-full text-xl sm:text-2xl font-black border-4 border-zinc-400 shadow-brutal active-brutal-push focus:outline-none flex items-center justify-center gap-2 ${retryButtonTone}`}
            onClick={() => router.push(`/setup?genre=${session.genre_id}`)}
          >
            <RotateCcw className={ICON_SIZE.lg} strokeWidth={ICON_STROKE.bold} /> もういっかい！
          </button>
        </div>
      </div>

      {/* Chunky History Section */}
      <div className="bg-white p-6 sm:p-10 rounded-[3rem] border-4 border-zinc-400 shadow-brutal mt-8">
        <div className="bg-green-200 border-4 border-zinc-400 shadow-brutal-sm px-6 py-3 rounded-full w-fit -rotate-2 mb-8">
          <h2 className="text-2xl sm:text-3xl font-black text-green-900 flex items-center gap-3">
            <NotebookPen className={ICON_SIZE.lg} strokeWidth={ICON_STROKE.strong} />
            ふりかえり
          </h2>
        </div>
        
        <div className="flex flex-col gap-6">
          {history.map((record, index) => {
            const q = Array.isArray(record.questions) ? record.questions[0] : record.questions;
            if (!q) return null;
            return (
              <div key={index} className={`p-6 sm:p-8 rounded-[2rem] border-4 border-zinc-400 flex flex-col gap-4 shadow-brutal-sm ${
                record.is_correct ? 'bg-green-50/50' : 'bg-red-50'
              }`}>
                <div className="flex gap-4 items-start">
                   {record.is_correct ? (
                      <div className="bg-green-400 rounded-full shrink-0 border-2 border-zinc-400 shadow-sm mt-1">
                        <CheckCircle className="w-8 h-8 text-white" />
                      </div>
                   ) : (
                      <div className="bg-red-500 rounded-full shrink-0 border-2 border-zinc-400 shadow-sm mt-1 animate-wiggle">
                        <XCircle className="w-8 h-8 text-white" />
                      </div>
                   )}
                   <p className="font-black text-zinc-800 text-xl sm:text-2xl leading-snug flex-1 drop-shadow-sm">
                      <span className="opacity-50 mr-2">{index + 1}.</span>{q.question_text}
                   </p>
                   {record.is_correct && (
                     <span className="text-amber-500 font-black text-lg shrink-0 bg-amber-50 px-2 py-1 rounded-xl border-2 border-amber-300">
                       +{POINTS_PER_CORRECT}pt
                     </span>
                   )}
                </div>

                <div className="ml-12 flex flex-col gap-4 border-l-4 border-zinc-400 pl-6 mt-2 py-2">
                   {!record.is_correct && (
                     <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                       <span className="text-red-700 font-black bg-white border-2 border-zinc-400 shadow-sm px-3 py-1 rounded-xl w-fit">
                         あなたの こたえ:
                       </span>
                       <span className="text-xl sm:text-2xl font-bold text-zinc-600 line-through decoration-red-500 decoration-4">
                         {q.options[record.selected_index]}
                       </span>
                     </div>
                   )}
                   <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                     <span className="text-green-700 font-black bg-white border-2 border-zinc-400 shadow-sm px-3 py-1 rounded-xl w-fit">
                       せいかい:
                     </span>
                     <span className="text-xl sm:text-2xl font-black text-green-700 bg-green-100 px-3 py-1 rounded-xl border-2 border-green-300">
                       {q.options[q.correct_index]}
                     </span>
                   </div>
                   
                   {q.explanation && (
                     <div className="mt-4 p-5 bg-white rounded-2xl border-4 border-zinc-400 shadow-brutal-sm relative">
                        {/* decorative tape */}
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-16 h-6 bg-yellow-200/80 -rotate-2 mix-blend-multiply" />
                        <p className="text-lg sm:text-xl font-bold text-zinc-800 leading-relaxed">
                          {q.explanation}
                        </p>
                     </div>
                   )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
