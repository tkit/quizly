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
      ? 'bg-slate-200 hover:bg-slate-300 text-slate-900'
      : session.genres?.color_hint === 'orange'
        ? 'bg-teal-100 hover:bg-teal-200 text-teal-900'
        : session.genres?.color_hint === 'green'
          ? 'bg-teal-200 hover:bg-teal-300 text-teal-950'
          : session.genres?.color_hint === 'pink'
            ? 'bg-teal-200 hover:bg-teal-300 text-teal-900'
            : session.genres?.color_hint === 'purple'
              ? 'bg-slate-200 hover:bg-slate-300 text-slate-900'
              : 'bg-zinc-200 hover:bg-zinc-300 text-zinc-900';

  const resultTone = isPerfect
    ? {
        panel: 'bg-amber-100',
        score: 'text-amber-800',
        icon: 'text-amber-700',
      }
    : isGood
      ? {
        panel: 'bg-slate-100',
        score: 'text-slate-700',
        icon: 'text-teal-800',
      }
      : {
          panel: 'bg-zinc-100',
          score: 'text-zinc-700',
          icon: 'text-zinc-700',
        };

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col gap-6 p-1.5 pb-safe-lg sm:gap-8 sm:p-3">
      {/* Massive Result Banner */}
      <div className={`relative overflow-hidden rounded-[2.2rem] border-4 border-zinc-400 p-5 text-center shadow-brutal-lg sm:rounded-[3.5rem] sm:p-12 ${resultTone.panel}`}>
        {/* Background decorations */}
        <div className="absolute left-4 top-4 h-10 w-10 rounded-full bg-white/50 blur-sm sm:h-12 sm:w-12" />
        <div className="absolute bottom-10 right-10 h-16 w-16 rounded-full bg-white/40 blur-md sm:bottom-12 sm:right-12 sm:h-24 sm:w-24" />
        
        <div className="relative z-10 mb-3 flex justify-center animate-bounce drop-shadow-[4px_4px_0_rgba(24,24,27,1)] sm:mb-4">
          <ResultIcon
            className={`${ICON_SIZE.hero} ${resultTone.icon}`}
            strokeWidth={ICON_STROKE.medium}
          />
        </div>
        
        <h1 className="relative z-10 mb-4 text-[clamp(2rem,10vw,3.75rem)] font-black tracking-wide text-zinc-900 drop-shadow-sm">
          {isPerfect ? 'パーフェクト' : isGood ? 'すばらしい結果です' : 'おつかれさまでした'}
        </h1>
        
        <div className="relative z-10 mt-1 inline-block rotate-1 rounded-full border-4 border-zinc-400 bg-white px-4 py-2 shadow-brutal sm:mt-2 sm:px-8 sm:py-3">
          <p className="text-[clamp(1.1rem,5vw,1.9rem)] font-black text-zinc-800">
             {session.total_questions}問中 <span className={`mx-1 text-[clamp(2rem,10vw,3rem)] ${resultTone.score}`}>{session.correct_count}</span> 問正解
          </p>
        </div>

        {/* Points Display */}
        {earnedPoints > 0 && (
          <div className="relative z-10 mt-6 animate-points-pop sm:mt-8">
            <div className={`inline-flex max-w-full -rotate-1 flex-col items-center gap-2 rounded-[2rem] border-4 px-5 py-4 shadow-brutal sm:px-10 sm:py-5 ${
              isPerfect
                ? 'bg-gradient-to-br from-amber-50 to-amber-100 border-amber-300'
                : 'bg-gradient-to-br from-teal-50 to-teal-100 border-teal-300'
            }`}>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Star className={`h-6 w-6 sm:h-8 sm:w-8 ${isPerfect ? 'text-amber-600 fill-amber-300' : 'text-teal-600 fill-teal-300'}`} />
                <span className={`text-[clamp(1.25rem,5.2vw,1.9rem)] font-black ${isPerfect ? 'text-amber-900' : 'text-teal-900'}`}>ポイント獲得</span>
                <Star className={`h-6 w-6 sm:h-8 sm:w-8 ${isPerfect ? 'text-amber-600 fill-amber-300' : 'text-teal-600 fill-teal-300'}`} />
              </div>
              <div className={`text-[clamp(2.2rem,12vw,4.5rem)] font-black tabular-nums tracking-tight ${isPerfect ? 'text-amber-800' : 'text-teal-800'}`}>
                +{displayPoints}<span className="ml-1 text-[clamp(1.4rem,7vw,2.25rem)]">pt</span>
              </div>
              {isPerfect && bonusPoints > 0 && (
                <div className="rotate-1 rounded-full border-2 border-amber-300 bg-amber-50 px-3 py-1 text-sm font-black text-amber-900 shadow-brutal-sm sm:px-4 sm:text-xl">
                  <span className="inline-flex items-center gap-2">
                    <BadgeCheck className={ICON_SIZE.sm} strokeWidth={ICON_STROKE.strong} />
                    パーフェクトボーナス ×1.5！ +{bonusPoints}pt
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="relative z-10 mt-8 flex flex-col justify-center gap-3 sm:mt-12 sm:flex-row sm:gap-4">
          <button 
            className="flex min-h-11 items-center justify-center gap-2 rounded-full border-4 border-zinc-400 bg-zinc-50 px-6 py-3 text-lg font-black text-zinc-700 shadow-brutal hover:bg-zinc-100 active-brutal-push focus:outline-none sm:h-16 sm:px-8 sm:text-2xl"
            onClick={() => router.push('/dashboard')}
          >
            <Home className={ICON_SIZE.lg} strokeWidth={ICON_STROKE.bold} />
            ダッシュボードへ
            <Sparkles className={`${ICON_SIZE.md} text-teal-600`} strokeWidth={ICON_STROKE.strong} />
          </button>
          <button
            className={`flex min-h-11 items-center justify-center gap-2 rounded-full border-4 border-zinc-400 px-6 py-3 text-lg font-black shadow-brutal active-brutal-push focus:outline-none sm:h-16 sm:px-8 sm:text-2xl ${retryButtonTone}`}
            onClick={() => router.push(`/quiz?genre=${session.genre_id}`)}
          >
            <RotateCcw className={ICON_SIZE.lg} strokeWidth={ICON_STROKE.bold} /> もう一度挑戦
          </button>
        </div>
      </div>

      {/* Chunky History Section */}
      <div className="mt-4 rounded-[2.2rem] border-4 border-zinc-400 bg-white p-4 shadow-brutal sm:mt-8 sm:rounded-[3rem] sm:p-10">
        <div className="mb-6 w-fit -rotate-2 rounded-full border-4 border-zinc-400 bg-teal-100 px-4 py-2 shadow-brutal-sm sm:mb-8 sm:px-6 sm:py-3">
          <h2 className="flex items-center gap-3 text-[clamp(1.2rem,5vw,1.9rem)] font-black text-teal-900">
            <NotebookPen className={ICON_SIZE.lg} strokeWidth={ICON_STROKE.strong} />
            学習の振り返り
          </h2>
        </div>
        
        <div className="flex flex-col gap-6">
          {history.map((record, index) => {
            const q = Array.isArray(record.questions) ? record.questions[0] : record.questions;
            if (!q) return null;
            return (
              <div key={index} className={`flex flex-col gap-3 rounded-[1.6rem] border-4 border-zinc-400 p-4 shadow-brutal-sm sm:gap-4 sm:rounded-[2rem] sm:p-8 ${
                record.is_correct ? 'bg-teal-50/50' : 'bg-rose-50'
              }`}>
                <div className="flex items-start gap-3 sm:gap-4">
                   {record.is_correct ? (
                      <div className="mt-1 shrink-0 rounded-full border-2 border-zinc-400 bg-teal-400 shadow-sm">
                        <CheckCircle className="h-7 w-7 text-white sm:h-8 sm:w-8" />
                      </div>
                   ) : (
                      <div className="mt-1 shrink-0 rounded-full border-2 border-zinc-400 bg-rose-500 shadow-sm animate-wiggle">
                        <XCircle className="h-7 w-7 text-white sm:h-8 sm:w-8" />
                      </div>
                   )}
                   <p className="flex-1 text-lg font-black leading-snug text-zinc-800 drop-shadow-sm sm:text-2xl">
                      <span className="opacity-50 mr-2">{index + 1}.</span>{q.question_text}
                   </p>
                   {record.is_correct && (
                     <span className="shrink-0 rounded-xl border-2 border-teal-300 bg-teal-50 px-2 py-1 text-sm font-black text-teal-600 sm:text-lg">
                       +{POINTS_PER_CORRECT}pt
                     </span>
                   )}
                </div>

                <div className="mt-1 flex flex-col gap-3 border-t-4 border-zinc-300 pt-4 sm:mt-2 sm:gap-4 sm:border-l-4 sm:border-t-0 sm:border-zinc-400 sm:py-2 sm:pl-6 sm:ml-12">
                   {!record.is_correct && (
                     <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                       <span className="text-rose-700 font-black bg-white border-2 border-zinc-400 shadow-sm px-3 py-1 rounded-xl w-fit">
                         あなたの回答:
                       </span>
                       <span className="text-lg font-bold text-zinc-600 line-through decoration-rose-500 decoration-4 sm:text-2xl">
                         {q.options[record.selected_index]}
                       </span>
                     </div>
                   )}
                   <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                     <span className="text-teal-700 font-black bg-white border-2 border-zinc-400 shadow-sm px-3 py-1 rounded-xl w-fit">
                       正解:
                     </span>
                     <span className="rounded-xl border-2 border-teal-300 bg-teal-100 px-3 py-1 text-lg font-black text-teal-700 sm:text-2xl">
                       {q.options[q.correct_index]}
                     </span>
                   </div>
                   
                   {q.explanation && (
                     <div className="relative mt-3 rounded-2xl border-4 border-zinc-400 bg-white p-4 shadow-brutal-sm sm:mt-4 sm:p-5">
                        {/* decorative tape */}
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-16 h-6 bg-teal-200/80 -rotate-2 mix-blend-multiply" />
                        <p className="text-base font-bold leading-relaxed text-zinc-800 sm:text-xl">
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
