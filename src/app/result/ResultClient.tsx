'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { BadgeCheck, CheckCircle, Home, NotebookPen, RotateCcw, Sparkles, Star, XCircle } from 'lucide-react';
import { POINTS_PER_CORRECT } from '@/lib/points';
import { fireResultEffect } from '@/lib/effects/confetti';
import { ICON_SIZE, ICON_STROKE } from '@/lib/ui/iconTokens';
import { resolveSubjectTone } from '@/lib/ui/subjectTone';

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
    color_hint: string | null;
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
  const [expandedHistoryByIndex, setExpandedHistoryByIndex] = useState<Record<number, boolean>>({});

  const isPerfect = session.correct_count === session.total_questions;
  const isGood = session.correct_count >= session.total_questions * 0.8;
  const earnedPoints = session.earned_points || 0;
  const basePoints = session.correct_count * POINTS_PER_CORRECT;
  const bonusPoints = earnedPoints - basePoints;
  const subjectTone = resolveSubjectTone(null, session.genres?.color_hint ?? null);

  const displayPoints = useCountUp(earnedPoints, 1500);
  const hasTriggeredResultEffect = useRef(false);

  useEffect(() => {
    if (earnedPoints <= 0 || hasTriggeredResultEffect.current) return;
    hasTriggeredResultEffect.current = true;
    void fireResultEffect({ isPerfect });
  }, [earnedPoints, isPerfect]);

  const resultTone = isPerfect
    ? {
        panel: 'bg-amber-100',
        score: 'text-amber-800',
        subline: '全問正解です。すばらしい！',
      }
    : isGood
      ? {
        panel: 'bg-slate-100',
        score: 'text-slate-700',
        subline: 'この調子で次のカテゴリへ進もう。',
      }
      : {
          panel: 'bg-zinc-100',
          score: 'text-zinc-700',
          subline: '振り返りを見て、もう一度チャレンジしよう。',
        };

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col gap-6 p-1.5 pb-safe-lg sm:gap-8 sm:p-3">
      {/* Massive Result Banner */}
      <div className={`relative overflow-hidden rounded-[2.2rem] border-4 border-zinc-400 p-5 text-center shadow-brutal-lg sm:rounded-[3.5rem] sm:p-12 ${resultTone.panel}`}>
        {/* Background decorations */}
        <div className="absolute left-4 top-4 h-10 w-10 rounded-full bg-white/50 blur-sm sm:h-12 sm:w-12" />
        <div className="absolute bottom-10 right-10 h-16 w-16 rounded-full bg-white/40 blur-md sm:bottom-12 sm:right-12 sm:h-24 sm:w-24" />

        {isPerfect && (
          <div className="relative z-10 mb-3 flex justify-center sm:mb-4">
            <Image
              src="/illustrations/result-trophy.svg"
              alt="パーフェクト達成トロフィー"
              width={170}
              height={117}
              priority
              className="h-auto w-[120px] sm:w-[170px]"
            />
          </div>
        )}

        <h1 className="relative z-10 mb-4 text-[clamp(2rem,10vw,3.4rem)] font-black tracking-wide text-zinc-900 drop-shadow-sm">
          {isPerfect ? 'パーフェクト' : isGood ? 'すばらしい結果です' : 'おつかれさまでした'}
        </h1>

        <p className="relative z-10 mb-2 text-[clamp(1rem,4.5vw,1.2rem)] font-bold text-zinc-700 sm:mb-3">
          {resultTone.subline}
        </p>
        
        <div className="relative z-10 mt-1 inline-block rotate-1 rounded-full border-4 border-zinc-400 bg-white px-4 py-2 shadow-brutal sm:mt-2 sm:px-8 sm:py-3">
          <p className="text-[clamp(1.1rem,5vw,1.9rem)] font-black text-zinc-800">
             {session.total_questions}問中 <span className={`mx-1 text-[clamp(2rem,10vw,3rem)] ${resultTone.score}`}>{session.correct_count}</span> 問正解
          </p>
        </div>

        {/* Points Display */}
        {earnedPoints > 0 && (
          <div className="relative z-10 mt-6 sm:mt-8">
            <div className={`subject-stripe-bottom inline-flex max-w-full flex-col items-stretch gap-4 rounded-[2rem] border-4 px-5 py-4 shadow-soft-accent sm:px-10 sm:py-5 ${
              isPerfect
                ? 'bg-gradient-to-br from-amber-50 to-amber-100 border-amber-300'
                : 'bg-gradient-to-br from-slate-50 to-slate-100 border-slate-300'
            }`}>
              <div className="flex items-center justify-center gap-1.5 sm:gap-2">
                <Star className={`h-6 w-6 sm:h-8 sm:w-8 ${isPerfect ? 'text-amber-600 fill-amber-300' : 'text-slate-600 fill-slate-300'}`} />
                <span className={`text-[clamp(1.25rem,5.2vw,1.9rem)] font-black ${isPerfect ? 'text-amber-900' : 'text-slate-900'}`}>ポイント獲得</span>
                <Star className={`h-6 w-6 sm:h-8 sm:w-8 ${isPerfect ? 'text-amber-600 fill-amber-300' : 'text-slate-600 fill-slate-300'}`} />
              </div>

              <div className="rounded-[1.6rem] border-4 border-zinc-400 bg-white/90 px-4 py-3 shadow-brutal-sm sm:px-6 sm:py-4">
                <p className="text-sm font-black text-zinc-600 sm:text-base">合計獲得pt</p>
                <div className={`mt-1 text-[clamp(2.2rem,12vw,4.5rem)] font-black tabular-nums tracking-tight ${isPerfect ? 'text-amber-800' : 'text-slate-800'}`}>
                  +{displayPoints}<span className="ml-1 text-[clamp(1.4rem,7vw,2.25rem)]">pt</span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 rounded-[1.2rem] border-4 border-zinc-400 bg-white/80 p-3 text-left shadow-brutal-sm sm:grid-cols-2 sm:gap-3 sm:p-4">
                <div className={`rounded-xl border-2 px-3 py-2 ${subjectTone.correctClass}`}>
                  <p className="text-xs font-black sm:text-sm">正答ポイント</p>
                  <p className="text-xl font-black sm:text-2xl">+{basePoints}pt</p>
                </div>
                <div className={`rounded-xl border-2 px-3 py-2 ${
                  bonusPoints > 0
                    ? 'border-amber-300 bg-amber-50'
                    : 'border-zinc-300 bg-zinc-100'
                }`}>
                  <p className={`text-xs font-black sm:text-sm ${
                    bonusPoints > 0 ? 'text-amber-700' : 'text-zinc-600'
                  }`}>ボーナス</p>
                  <p className={`text-xl font-black sm:text-2xl ${
                    bonusPoints > 0 ? 'text-amber-800' : 'text-zinc-700'
                  }`}>+{Math.max(bonusPoints, 0)}pt</p>
                </div>
              </div>

              {isPerfect && bonusPoints > 0 && (
                <div className="rounded-full border-2 border-amber-300 bg-amber-50 px-3 py-1 text-sm font-black text-amber-900 shadow-brutal-sm sm:px-4 sm:text-xl">
                  <span className="inline-flex items-center gap-2">
                    <BadgeCheck className={ICON_SIZE.sm} strokeWidth={ICON_STROKE.strong} />
                    パーフェクトボーナス ×1.5 適用
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
            <Sparkles className={`${ICON_SIZE.md} text-slate-600`} strokeWidth={ICON_STROKE.strong} />
          </button>
          <button
            className={`flex min-h-11 items-center justify-center gap-2 rounded-full border-4 border-zinc-400 px-6 py-3 text-lg font-black shadow-brutal active-brutal-push focus:outline-none sm:h-16 sm:px-8 sm:text-2xl ${subjectTone.ctaClass} ${subjectTone.ctaHoverClass}`}
            onClick={() => router.push(`/quiz?genre=${session.genre_id}`)}
          >
            <RotateCcw className={ICON_SIZE.lg} strokeWidth={ICON_STROKE.bold} /> もう一度挑戦
          </button>
        </div>
      </div>

      {/* Chunky History Section */}
      <div className="mt-4 rounded-[2.2rem] border-4 border-zinc-400 bg-white p-4 shadow-brutal sm:mt-8 sm:rounded-[3rem] sm:p-10">
        <div className={`mb-6 w-fit -rotate-2 rounded-full border-4 border-zinc-400 px-4 py-2 shadow-brutal-sm sm:mb-8 sm:px-6 sm:py-3 ${subjectTone.accentSoftClass}`}>
          <h2 className={`flex items-center gap-3 text-[clamp(1.2rem,5vw,1.9rem)] font-black ${subjectTone.accentTextClass}`}>
            <NotebookPen className={ICON_SIZE.lg} strokeWidth={ICON_STROKE.strong} />
            学習の振り返り
          </h2>
        </div>
        
        <div className="flex flex-col gap-6">
          {history.map((record, index) => {
            const q = Array.isArray(record.questions) ? record.questions[0] : record.questions;
            if (!q) return null;
            const awardedPoints = record.is_correct ? POINTS_PER_CORRECT : 0;
            return (
              <div key={index} className={`flex flex-col gap-3 rounded-[1.6rem] border-4 border-zinc-400 p-4 shadow-brutal-sm sm:gap-4 sm:rounded-[2rem] sm:p-8 ${
                record.is_correct ? 'bg-slate-50' : 'bg-rose-50'
              }`}>
                <div className="flex items-start justify-between gap-3 sm:gap-4">
                  <div className="mt-0.5 flex shrink-0 gap-2 sm:gap-3">
                    <span className={`rounded-full border-2 px-3 py-1 text-xs font-black sm:text-sm ${
                      record.is_correct
                        ? subjectTone.correctClass
                        : 'border-rose-300 bg-rose-100 text-rose-700'
                    }`}>
                      {record.is_correct ? '正解' : '不正解'}
                    </span>
                    <span className={`rounded-full border-2 px-3 py-1 text-xs font-black sm:text-sm ${
                      awardedPoints > 0
                        ? 'border-amber-300 bg-amber-100 text-amber-800'
                        : 'border-zinc-300 bg-zinc-100 text-zinc-700'
                    }`}>
                      +{awardedPoints}pt
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3 sm:gap-4">
                   {record.is_correct ? (
                      <div className={`mt-1 shrink-0 rounded-full border-2 border-zinc-400 ${subjectTone.progressClass} shadow-sm`}>
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
                     <span className={`font-black bg-white border-2 border-zinc-400 shadow-sm px-3 py-1 rounded-xl w-fit ${subjectTone.accentTextClass}`}>
                       正解:
                     </span>
                     <span className={`rounded-xl border-2 px-3 py-1 text-lg font-black sm:text-2xl ${subjectTone.correctClass}`}>
                       {q.options[q.correct_index]}
                     </span>
                   </div>
                   
                   {q.explanation && (
                     <>
                       <button
                         type="button"
                         className="sm:hidden mt-2 w-full rounded-xl border-2 border-zinc-400 bg-white px-3 py-2 text-sm font-black text-zinc-700 shadow-brutal-sm active-brutal-push"
                         onClick={() =>
                           setExpandedHistoryByIndex((prev) => ({
                             ...prev,
                             [index]: !prev[index],
                           }))
                         }
                       >
                         {expandedHistoryByIndex[index] ? '解説を閉じる' : '解説を見る'}
                       </button>

                       <div className={`${expandedHistoryByIndex[index] ? 'block' : 'hidden'} relative mt-2 rounded-2xl border-4 border-zinc-400 bg-white p-4 shadow-brutal-sm sm:mt-4 sm:block sm:p-5`}>
                          {/* decorative tape */}
                          <div className="absolute -top-3 left-1/2 -translate-x-1/2 h-6 w-16 -rotate-2 bg-slate-200/80 mix-blend-multiply" />
                          <p className="text-base font-bold leading-relaxed text-zinc-800 sm:text-xl">
                            {q.explanation}
                          </p>
                       </div>
                     </>
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
