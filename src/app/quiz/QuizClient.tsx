'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { X, CheckCircle, XCircle } from 'lucide-react';

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
  icon: string | null;
  color_hint: string | null;
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
        // Fetch incorrect history for this user
        const { data: history } = await supabase
          .from('study_history')
          .select('question_id, is_correct')
          .eq('user_id', storedUserId)
          .eq('is_correct', false);

        if (history && history.length > 0) {
          // Extract unique question IDs that the user has got wrong
          const wrongQuestionIds = Array.from(new Set(history.map(h => h.question_id)));
          
          // Filter the pool
          pool = pool.filter(q => wrongQuestionIds.includes(q.id));
        } else {
          // If no incorrect history, pool becomes empty or just fallback to normal
          pool = []; // Can show "You have no review questions!"
        }
      }

      // Shuffle and slice to the requested count
      const shuffled = pool.sort(() => 0.5 - Math.random());
      setQuestions(shuffled.slice(0, count));
      setIsLoading(false);
    };

    fetchReviewQuestionsAndInit();
  }, [allQuestions, count, mode, router]);

  const targetColor =
    genre.color_hint === 'blue' ? 'blue' :
    genre.color_hint === 'orange' ? 'orange' :
    genre.color_hint === 'green' ? 'green' : 'zinc';


  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center h-full">
        <p className="text-xl text-zinc-500 font-bold">じゅんび中...</p>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center gap-6 h-full text-center">
        <div className="text-6xl">🎉</div>
        <p className="text-xl text-zinc-600 font-bold max-w-sm">
          {mode === 'review' 
            ? 'ニガテな問題がひとつもありません！すばらしい！' 
            : 'このジャンルにはまだ問題がありません。'}
        </p>
        <Button size="lg" className="rounded-full text-lg h-14 px-8 mt-4" onClick={() => router.push('/dashboard')}>
          ダッシュボードにもどる
        </Button>
      </div>
    );
  }

  const handleOptionClick = (index: number) => {
    if (isAnswered) return;
    
    setSelectedOption(index);
    setIsAnswered(true);
    
    const isCorrect = index === currentQuestion.correct_index;
    if (isCorrect) setCorrectCount(prev => prev + 1);

    // Save history record in memory
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
      // Finish Session
      await saveSessionAndRedirect();
    }
  };

  const saveSessionAndRedirect = async () => {
    if (!userId || isSubmitting) return;
    setIsSubmitting(true);

    try {
      // 1. Create Session
      const { data: sessionData, error: sessionError } = await supabase
        .from('study_sessions')
        .insert({
          user_id: userId,
          genre_id: genre.id,
          mode: mode,
          total_questions: questions.length,
          correct_count: correctCount,
          completed_at: new Date().toISOString()
        })
        .select()
        .single();

      if (sessionError) throw sessionError;

      // 2. Create History Records
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

      // 3. Redirect to Result page
      router.push(`/result?session_id=${sessionData.id}`);

    } catch (err) {
      console.error('Failed to save session:', err);
      // Even if saving fails, maybe redirect so user is not stuck?
      alert('通信エラーで記録が保存できませんでした。');
      setIsSubmitting(false);
    }
  };


  return (
    <div className="flex flex-col h-full gap-6">
      <header className="flex items-center gap-4 bg-white p-4 rounded-3xl shadow-sm">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full shrink-0 text-zinc-400 hover:text-red-500">
          <X className="w-6 h-6" />
        </Button>
        <div className="flex-1">
          <div className="flex justify-between items-center mb-2 px-2">
            <span className="text-sm font-bold text-zinc-500">{currentIndex + 1}問目 / 全{questions.length}問</span>
          </div>
          <Progress value={progressValue} className={`h-3 bg-${targetColor}-100`} />
        </div>
      </header>

      <Card className={`flex-1 flex flex-col items-center justify-center p-6 border-b-8 border-${targetColor}-200 rounded-[2rem] min-h-[40vh]`}>
        <h2 className="text-2xl sm:text-3xl font-bold text-center leading-relaxed text-zinc-800">
          {currentQuestion.question_text}
        </h2>
      </Card>

      <div className="grid grid-cols-1 gap-4 mt-2">
        {currentQuestion.options.map((option, index) => {
          let stateClass = "bg-white border-2 border-zinc-200 hover:border-zinc-300 text-zinc-700";
          if (isAnswered) {
             if (index === currentQuestion.correct_index) {
                stateClass = "bg-green-100 border-4 border-green-500 text-green-900"; // Correct visually obvious
             } else if (index === selectedOption) {
                stateClass = "bg-red-50 border-4 border-red-400 text-red-900 opacity-60"; // Incorrect selected
             } else {
                stateClass = "bg-white opacity-40 border-2 border-zinc-200"; // Untouched
             }
          }

          return (
            <Button
              key={index}
              disabled={isAnswered}
              className={`h-auto min-h-16 text-xl p-4 sm:p-6 rounded-2xl whitespace-normal break-all font-bold text-left justify-start transition-all shadow-sm ${stateClass}`}
              onClick={() => handleOptionClick(index)}
            >
               <span className="mr-3 text-lg opacity-50 font-sans">{index + 1}.</span> {option}
            </Button>
          )
        })}
      </div>

      {/* 解答直後のフィードバック ダイアログの代わりに今回は下部パネル形式 */}
      {isAnswered && (
        <div className={`mt-4 p-6 rounded-3xl border-2 flex flex-col gap-4 animate-in slide-in-from-bottom-4 duration-300 ${
           selectedOption === currentQuestion.correct_index 
            ? 'bg-green-50 border-green-200' 
            : 'bg-red-50 border-red-200'
        }`}>
           <div className="flex items-center gap-3">
              {selectedOption === currentQuestion.correct_index ? (
                 <><CheckCircle className="w-8 h-8 text-green-500" /><span className="text-2xl font-bold text-green-700">せいかい！</span></>
              ) : (
                 <><XCircle className="w-8 h-8 text-red-500" /><span className="text-2xl font-bold text-red-700">ざんねん！</span></>
              )}
           </div>
           
           {currentQuestion.explanation && (
             <div className="p-4 bg-white/60 rounded-2xl">
                <p className="text-lg text-zinc-800 font-medium leading-relaxed">{currentQuestion.explanation}</p>
             </div>
           )}

           <Button 
            className={`h-16 text-xl rounded-full font-bold shadow-md w-full mt-2 ${
              selectedOption === currentQuestion.correct_index 
                ? 'bg-green-600 hover:bg-green-700 text-white' 
                : 'bg-red-500 hover:bg-red-600 text-white'
            }`}
             onClick={handleNext}
             disabled={isSubmitting}
           >
             {isSubmitting ? 'きろく中...' : (currentIndex < questions.length - 1 ? 'つぎのもんだいへ' : 'けっかをみる')}
           </Button>
        </div>
      )}
    </div>
  );
}
