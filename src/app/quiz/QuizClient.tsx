'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ArrowRight, CheckCircle, PartyPopper, Sparkles, X, XCircle } from 'lucide-react';
import { calculateSessionPoints } from '@/lib/points';
import { fireCorrectEffect } from '@/lib/effects/confetti';
import { ICON_SIZE, ICON_STROKE } from '@/lib/ui/iconTokens';

interface Question {
  id: string;
  genre_id: string;
  question_text: string;
  options: string[];
  correct_index: number;
  explanation: string | null;
  image_url: string | null;
}

interface Genre {
  id: string;
  name: string;
  icon_key: string;
  color_hint: string | null;
  parent_id: string | null;
}

export default function QuizClient({
  genre,
  allQuestions,
  mode,
  count,
}: {
  genre: Genre;
  allQuestions: Question[];
  mode: string;
  count: number;
}) {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [historyRecords, setHistoryRecords] = useState<{question_id: string, is_correct: boolean, selected_index: number}[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load user and filter questions
  useEffect(() => {
    const fetchReviewQuestionsAndInit = async () => {
      const storedUserId = localStorage.getItem('quizly_user_id');
      if (!storedUserId) {
        router.push('/');
        return;
      }
      setUserId(storedUserId);

      let pool = [...allQuestions];

      if (mode === 'review') {
        const { data: history } = await supabase
          .from('study_history')
          .select('question_id, is_correct')
          .eq('user_id', storedUserId)
          .eq('is_correct', false);

        if (history && history.length > 0) {
          const wrongQuestionIds = Array.from(new Set(history.map(h => h.question_id)));
          pool = pool.filter(q => wrongQuestionIds.includes(q.id));
        } else {
          pool = []; 
        }
      }

      const shuffled = pool.sort(() => 0.5 - Math.random());
      setQuestions(shuffled.slice(0, count));
      setIsLoading(false);
    };

    fetchReviewQuestionsAndInit();
  }, [allQuestions, count, mode, router]);

  const tone =
    genre.color_hint === 'blue'
      ? { progress: 'bg-slate-300' }
      : genre.color_hint === 'orange'
        ? { progress: 'bg-teal-200' }
        : genre.color_hint === 'green'
          ? { progress: 'bg-teal-300' }
          : genre.color_hint === 'pink'
            ? { progress: 'bg-teal-300' }
            : genre.color_hint === 'purple'
              ? { progress: 'bg-slate-300' }
              : { progress: 'bg-zinc-400' };


  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center h-full">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-8 border-slate-100 border-t-slate-300 rounded-full animate-spin"></div>
          <p className="text-2xl font-black text-teal-500 animate-pulse">準備中...</p>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="flex h-full flex-1 flex-col items-center justify-center gap-5 p-4 text-center sm:gap-6">
        <PartyPopper className={`${ICON_SIZE.hero} animate-bounce-soft text-teal-600`} strokeWidth={ICON_STROKE.regular} />
        <p className="w-full max-w-lg rounded-3xl border-4 border-zinc-400 bg-white px-5 py-4 text-[clamp(1.25rem,5.5vw,1.8rem)] font-black text-zinc-800 shadow-brutal sm:px-8">
          {mode === 'review' 
            ? '苦手な問題はありません。すばらしい！' 
            : 'このジャンルには問題がありません。'}
        </p>
        {mode === 'review' && (
          <div className="inline-flex items-center gap-2 text-lg font-black text-teal-700 sm:text-xl">
            <Sparkles className={ICON_SIZE.sm} strokeWidth={ICON_STROKE.strong} />
            よくできました
          </div>
        )}
        <button 
          className="mt-4 min-h-11 rounded-full border-4 border-zinc-400 bg-teal-300 px-8 py-3 text-xl font-black text-zinc-900 shadow-brutal transition-all hover:-translate-y-1 hover:bg-teal-400 hover:shadow-brutal-lg active-brutal-push sm:mt-8 sm:px-12 sm:py-4 sm:text-2xl"
          onClick={() => router.push('/dashboard')}
        >
          戻る
        </button>
      </div>
    );
  }

  const handleOptionClick = (index: number) => {
    if (isAnswered) return;
    
    setSelectedOption(index);
    setIsAnswered(true);
    
    const isCorrect = index === currentQuestion.correct_index;
    if (isCorrect) {
      setCorrectCount(prev => prev + 1);
      void fireCorrectEffect();
    }

    setHistoryRecords(prev => [...prev, {
      question_id: currentQuestion.id,
      is_correct: isCorrect,
      selected_index: index,
    }]);
  };

  const currentQuestion = questions[currentIndex];
  const progressValue = ((currentIndex + 1) / questions.length) * 100;
  const isCurrentCorrect = selectedOption === currentQuestion.correct_index;

  const handleNext = async () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSelectedOption(null);
      setIsAnswered(false);
    } else {
      await saveSessionAndRedirect();
    }
  };

  const saveSessionAndRedirect = async () => {
    if (!userId || isSubmitting) return;
    setIsSubmitting(true);

    try {
      // Calculate points
      const pointsResult = calculateSessionPoints(correctCount, questions.length);

      // Save session with earned points
      const { data: sessionData, error: sessionError } = await supabase
        .from('study_sessions')
        .insert({
          user_id: userId,
          genre_id: genre.id,
          mode: mode,
          total_questions: questions.length,
          correct_count: correctCount,
          earned_points: pointsResult.totalPoints,
          completed_at: new Date().toISOString()
        })
        .select()
        .single();

      if (sessionError) throw sessionError;

      // Save study history
      const historyToInsert = historyRecords.map(record => ({
        session_id: sessionData.id,
        user_id: userId,
        question_id: record.question_id,
        is_correct: record.is_correct,
        selected_index: record.selected_index,
      }));

      const { error: historyError } = await supabase
        .from('study_history')
        .insert(historyToInsert);

      if (historyError) throw historyError;

      // Save point transactions
      if (pointsResult.totalPoints > 0) {
        const pointTransactions: { user_id: string; session_id: string; points: number; reason: string }[] = [];

        // Base points for correct answers
        if (pointsResult.basePoints > 0) {
          pointTransactions.push({
            user_id: userId,
            session_id: sessionData.id,
            points: pointsResult.basePoints,
            reason: 'correct_answer',
          });
        }

        // Perfect bonus
        if (pointsResult.bonusPoints > 0) {
          pointTransactions.push({
            user_id: userId,
            session_id: sessionData.id,
            points: pointsResult.bonusPoints,
            reason: 'perfect_bonus',
          });
        }

        const { error: pointError } = await supabase
          .from('point_transactions')
          .insert(pointTransactions);

        if (pointError) {
          console.error('Failed to save point transactions:', pointError);
          // Don't throw - points are secondary, session is saved
        }

        // Update user's total points
        const { data: userData } = await supabase
          .from('users')
          .select('total_points')
          .eq('id', userId)
          .single();

        const currentPoints = userData?.total_points || 0;
        const { error: updateError } = await supabase
          .from('users')
          .update({ total_points: currentPoints + pointsResult.totalPoints })
          .eq('id', userId);

        if (updateError) {
          console.error('Failed to update total points:', updateError);
        }
      }

      router.push(`/result?session_id=${sessionData.id}`);

    } catch (err) {
      console.error('Failed to save session:', err);
      alert('通信エラーで記録が保存できませんでした。');
      setIsSubmitting(false);
    }
  };


  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col gap-4 p-1.5 sm:gap-6 sm:p-3">
      {/* Simplified Progress Header */}
      <header className="flex items-center gap-2 rounded-[2rem] border-4 border-zinc-400 bg-white px-2 py-2.5 shadow-brutal-sm sm:gap-4 sm:px-4 sm:py-4">
        <button 
          onClick={() => router.back()} 
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-4 border-zinc-400 bg-zinc-100 text-zinc-600 shadow-brutal hover:bg-zinc-200 active-brutal-push focus:outline-none sm:h-12 sm:w-12"
        >
          <X className="w-6 h-6 stroke-[3]" />
        </button>
        <div className="flex-1 pr-1 sm:pr-2">
          <span className="mb-2 block px-1 text-sm font-black text-zinc-700 sm:text-lg">{currentIndex + 1}問目 / 全{questions.length}問</span>
          <div className="relative h-5 w-full overflow-hidden rounded-full border-4 border-zinc-400 bg-zinc-200 sm:h-6">
             <div
               className={`absolute top-0 left-0 h-full rounded-full bg-gradient-to-r from-teal-300 to-teal-200 transition-all duration-500 ease-out ${tone.progress}`}
               style={{ width: `${progressValue}%` }}
             >
                <div className="absolute top-1 left-2 right-2 h-1 bg-white/40 rounded-full" />
             </div>
          </div>
        </div>
      </header>

      {/* Massive Question Bubble */}
      <div className="relative flex min-h-[26vh] flex-1 flex-col items-center justify-center rounded-[2.2rem] border-4 border-zinc-400 bg-white p-5 shadow-brutal sm:min-h-[30vh] sm:rounded-[3rem] sm:p-9 md:min-h-[40vh] md:p-12">
        {/* Decorative corner pin */}
        <div className="absolute -left-3 -top-3 z-10 h-8 w-8 rounded-full border-4 border-zinc-400 bg-teal-300 shadow-brutal-sm sm:-left-4 sm:-top-4 sm:h-10 sm:w-10" />
        <h2 className="text-center text-[clamp(1.5rem,7vw,3rem)] font-black leading-snug text-zinc-800 drop-shadow-sm">
          {currentQuestion.question_text}
        </h2>
      </div>

      {/* Chunky Options */}
      <div className="relative z-10 mb-4 grid w-full grid-cols-1 gap-3 pb-16 sm:mb-8 sm:gap-5 sm:pb-8">
        {currentQuestion.options.map((option, index) => {
          let stateClass = "bg-white border-zinc-400 hover:bg-slate-50 text-zinc-800 shadow-brutal active-brutal-push hover:-translate-y-1 hover:shadow-brutal-lg";
          let badgeColor = "bg-slate-100 text-teal-800";

          if (isAnswered) {
             if (index === currentQuestion.correct_index) {
                stateClass = "bg-teal-300 border-zinc-400 text-zinc-900 shadow-[0_0_0_4px_#5eead4,6px_6px_0_0_#a1a1aa] translate-y-[-2px]"; // Super obvious correct
                badgeColor = "bg-teal-100 text-teal-800";
             } else if (index === selectedOption) {
                stateClass = "bg-red-200 border-zinc-400 text-zinc-900 shadow-none translate-x-[4px] translate-y-[4px]"; // Pressed and wrong
                badgeColor = "bg-red-100 text-red-800";
             } else {
                stateClass = "bg-zinc-100 border-zinc-300 text-zinc-400 shadow-none"; // Disabled untouched
                badgeColor = "bg-zinc-200 text-zinc-400";
             }
          }

          return (
            <button
              key={index}
              disabled={isAnswered}
              className={`flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-[1.5rem] border-4 p-3 text-left text-[clamp(1.1rem,5.2vw,1.9rem)] font-black transition-all duration-200 focus:ring-4 focus:ring-teal-500 focus:outline-none sm:min-h-20 sm:gap-4 sm:rounded-[2rem] sm:p-6 ${stateClass}`}
              onClick={() => handleOptionClick(index)}
            >
               <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-zinc-400 text-lg shadow-inner sm:h-12 sm:w-12 sm:rounded-2xl sm:text-xl ${badgeColor}`}>
                 {index + 1}
               </div>
               <span className="flex-1 drop-shadow-sm break-words">{option}</span>
            </button>
          )
        })}
      </div>

      {/* Strong Feedback Panel pinned to bottom */}
      {isAnswered && (
        <div className="fixed inset-x-0 bottom-safe-4 z-50 flex justify-center px-3 sm:px-8 pointer-events-none">
          <div className={`quiz-feedback-enter pointer-events-auto flex max-h-[min(78dvh,720px)] w-full max-w-3xl flex-col gap-4 overflow-y-auto rounded-[2rem] border-4 border-zinc-400 p-4 shadow-brutal sm:gap-6 sm:rounded-[3rem] sm:p-8 pb-safe ${
             isCurrentCorrect 
              ? 'bg-teal-50' 
              : 'bg-red-50'
          }`}>
             <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                <div className="flex items-center gap-3 sm:gap-4">
                  {isCurrentCorrect ? (
                     <div className="flex items-center gap-3 animate-bounce-soft sm:gap-4">
                        <CheckCircle className="h-11 w-11 fill-white text-teal-500 sm:h-16 sm:w-16" />
                        <span className="text-[clamp(1.8rem,9vw,3rem)] font-black text-teal-600 drop-shadow-[2px_2px_0_#a1a1aa]">正解</span>
                     </div>
                  ) : (
                     <div className="flex items-center gap-3 animate-wiggle sm:gap-4">
                        <XCircle className="h-11 w-11 fill-white text-red-500 sm:h-16 sm:w-16" />
                        <span className="text-[clamp(1.8rem,9vw,3rem)] font-black text-red-600 drop-shadow-[2px_2px_0_#a1a1aa]">不正解</span>
                     </div>
                  )}
                </div>
                
                <button
                  className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-full border-4 border-zinc-400 bg-teal-300 px-6 py-3 text-xl font-black text-zinc-900 shadow-brutal hover:-translate-y-0.5 hover:bg-teal-400 hover:shadow-brutal-lg active-brutal-push focus:outline-none sm:mt-0 sm:w-auto sm:px-8 sm:py-5 sm:text-3xl"
                  onClick={handleNext}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? '記録を保存中...' : (currentIndex < questions.length - 1 ? '次へ' : '結果へ')}
                  {!isSubmitting && <ArrowRight className="h-6 w-6 sm:h-7 sm:w-7" />}
                </button>
             </div>

             <div className="rounded-2xl border-4 border-zinc-400 bg-white/90 p-3 shadow-brutal-sm sm:p-4">
               <p className="text-base font-black text-zinc-800 sm:text-xl">
                 正解: <span className="text-teal-700">{currentQuestion.options[currentQuestion.correct_index]}</span>
               </p>
             </div>

             {currentQuestion.explanation && (
               <div className="mt-1 rounded-3xl border-4 border-zinc-400 bg-white p-4 shadow-inner sm:mt-2 sm:p-6">
                  <p className="text-lg font-bold leading-relaxed text-zinc-800 sm:text-2xl">{currentQuestion.explanation}</p>
               </div>
             )}
          </div>
        </div>
      )}
    </div>
  );
}
