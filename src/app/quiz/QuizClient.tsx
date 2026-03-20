'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { CheckCircle, PartyPopper, Sparkles, X, XCircle } from 'lucide-react';
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
      <div className="flex flex-col flex-1 items-center justify-center gap-6 h-full text-center p-4">
        <PartyPopper className={`${ICON_SIZE.hero} animate-bounce-soft text-teal-600`} strokeWidth={ICON_STROKE.regular} />
        <p className="text-3xl font-black text-zinc-800 bg-white px-8 py-4 rounded-3xl border-4 border-zinc-400 shadow-brutal w-full max-w-lg">
          {mode === 'review' 
            ? '苦手な問題はありません。すばらしい！' 
            : 'このジャンルには問題がありません。'}
        </p>
        {mode === 'review' && (
          <div className="inline-flex items-center gap-2 text-teal-700 font-black text-xl">
            <Sparkles className={ICON_SIZE.sm} strokeWidth={ICON_STROKE.strong} />
            よくできました
          </div>
        )}
        <button 
          className="bg-teal-300 text-zinc-900 border-4 border-zinc-400 shadow-brutal hover:bg-teal-400 hover:-translate-y-1 hover:shadow-brutal-lg active-brutal-push rounded-full text-2xl font-black px-12 py-4 mt-8 transition-all"
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
  const progressValue = ((currentIndex) / questions.length) * 100;

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
    <div className="flex flex-col h-full gap-6 max-w-3xl mx-auto w-full p-2 sm:p-4">
      {/* Thick Progress Header */}
      <header className="flex items-center gap-4 bg-white p-4 rounded-full border-4 border-zinc-400 shadow-brutal-sm">
        <button 
          onClick={() => router.back()} 
          className="w-12 h-12 rounded-full bg-zinc-100 border-4 border-zinc-400 shadow-brutal flex items-center justify-center shrink-0 text-zinc-600 hover:bg-zinc-200 active-brutal-push focus:outline-none"
        >
          <X className="w-6 h-6 stroke-[3]" />
        </button>
        <div className="flex-1 pr-4">
          <div className="flex justify-between items-center mb-2 px-1">
            <span className="text-lg font-black text-zinc-700">{currentIndex + 1}問目 / 全{questions.length}問</span>
          </div>
          {/* Custom thick progress bar */}
          <div className="w-full h-6 bg-zinc-200 rounded-full border-4 border-zinc-400 overflow-hidden relative">
             <div
               className={`absolute top-0 left-0 h-full rounded-full transition-all duration-500 ease-out ${tone.progress}`}
               style={{ width: `${progressValue}%` }}
             >
                {/* Shine effect on progress bar */}
                <div className="absolute top-1 left-2 right-2 h-1 bg-white/40 rounded-full" />
             </div>
          </div>
        </div>
      </header>

      {/* Massive Question Bubble */}
      <div className={`relative flex-1 flex flex-col items-center justify-center p-8 sm:p-12 border-4 border-zinc-400 rounded-[3rem] bg-white shadow-brutal min-h-[30vh] md:min-h-[40vh]`}>
        {/* Decorative corner pin */}
        <div className="absolute -top-4 -left-4 w-10 h-10 bg-teal-300 rounded-full border-4 border-zinc-400 shadow-brutal-sm z-10" />
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-center leading-snug text-zinc-800 drop-shadow-sm">
          {currentQuestion.question_text}
        </h2>
      </div>

      {/* Chunky Options */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 mt-2 relative z-10 w-full mb-8">
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
              className={`min-h-20 text-2xl sm:text-3xl p-4 sm:p-6 rounded-[2rem] border-4 cursor-pointer font-black text-left flex items-center gap-4 transition-all duration-200 w-full focus:outline-none focus:ring-4 focus:ring-teal-500 ${stateClass}`}
              onClick={() => handleOptionClick(index)}
            >
               <div className={`shrink-0 w-12 h-12 flex items-center justify-center rounded-2xl border-2 border-zinc-400 ${badgeColor} shadow-inner text-xl`}>
                 {index + 1}
               </div>
               <span className="flex-1 drop-shadow-sm break-words">{option}</span>
            </button>
          )
        })}
      </div>

      {/* Massive Feedback Panel pinned to bottom */}
      {isAnswered && (
        <div className="fixed inset-x-0 bottom-0 z-50 p-4 sm:p-8 flex justify-center pointer-events-none">
          <div className={`quiz-feedback-enter pointer-events-auto w-full max-w-3xl p-6 sm:p-8 rounded-[3rem] border-4 border-zinc-400 shadow-brutal flex flex-col gap-6 ${
             selectedOption === currentQuestion.correct_index 
              ? 'bg-teal-50' 
              : 'bg-red-50'
          }`}>
             <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  {selectedOption === currentQuestion.correct_index ? (
                     <div className="flex items-center gap-4 animate-bounce-soft">
                        <CheckCircle className="w-16 h-16 text-teal-500 fill-white" />
                        <span className="text-4xl sm:text-5xl font-black text-teal-600 drop-shadow-[2px_2px_0_#a1a1aa]">正解</span>
                     </div>
                  ) : (
                     <div className="flex items-center gap-4 animate-wiggle">
                        <XCircle className="w-16 h-16 text-red-500 fill-white" />
                        <span className="text-4xl sm:text-5xl font-black text-red-600 drop-shadow-[2px_2px_0_#a1a1aa]">不正解</span>
                     </div>
                  )}
                </div>
                
                <button 
                  className={`px-8 py-4 sm:py-6 text-2xl sm:text-3xl rounded-full font-black border-4 border-zinc-400 shadow-brutal hover:scale-105 active-brutal-push focus:outline-none w-full sm:w-auto mt-4 sm:mt-0 ${
                    selectedOption === currentQuestion.correct_index 
                      ? 'bg-teal-300 text-zinc-900 hover:bg-teal-400' 
                      : 'bg-teal-300 text-zinc-900 hover:bg-teal-400'
                  }`}
                  onClick={handleNext}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? '記録を保存中...' : (currentIndex < questions.length - 1 ? '次へ進む' : '結果を見る')}
                </button>
             </div>
             
             {currentQuestion.explanation && (
               <div className="p-6 bg-white rounded-3xl border-4 border-zinc-400 shadow-inner mt-2">
                  <p className="text-xl sm:text-2xl text-zinc-800 font-bold leading-relaxed">{currentQuestion.explanation}</p>
               </div>
             )}
          </div>
        </div>
      )}
    </div>
  );
}
