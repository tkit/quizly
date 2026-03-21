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
  const [childId, setChildId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [historyRecords, setHistoryRecords] = useState<{question_id: string; is_correct: boolean; selected_index: number}[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        router.push('/');
        return;
      }

      const currentChildResponse = await fetch('/api/session/child/current', {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const currentChildBody = (await currentChildResponse.json().catch(() => null)) as { child?: { id: string } | null } | null;
      const currentChild = currentChildBody?.child;

      if (!currentChild) {
        router.push('/');
        return;
      }

      setChildId(currentChild.id);

      let pool = [...allQuestions];
      if (mode === 'review') {
        const { data: history } = await supabase
          .from('study_history')
          .select('question_id, is_correct')
          .eq('child_id', currentChild.id)
          .eq('is_correct', false);

        if (history && history.length > 0) {
          const wrongQuestionIds = Array.from(new Set(history.map((h: any) => h.question_id)));
          pool = pool.filter((q: Question) => wrongQuestionIds.includes(q.id));
        } else {
          pool = [];
        }
      }

      const shuffled = pool.sort(() => 0.5 - Math.random());
      setQuestions(shuffled.slice(0, count));
      setIsLoading(false);
    };

    void init();
  }, [allQuestions, count, mode, router]);

  const currentQuestion = questions[currentIndex];

  const handleOptionClick = (index: number) => {
    if (isAnswered) return;
    setSelectedOption(index);
    setIsAnswered(true);

    const isCorrect = index === currentQuestion.correct_index;
    if (isCorrect) {
      setCorrectCount((prev) => prev + 1);
      void fireCorrectEffect();
    }

    setHistoryRecords((prev) => [
      ...prev,
      {
        question_id: currentQuestion.id,
        is_correct: isCorrect,
        selected_index: index,
      },
    ]);
  };

  const handleNext = async () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedOption(null);
      setIsAnswered(false);
      return;
    }

    await saveSessionAndRedirect();
  };

  const saveSessionAndRedirect = async () => {
    if (!childId || isSubmitting) return;
    setIsSubmitting(true);

    try {
      const pointsResult = calculateSessionPoints(correctCount, questions.length);
      const { data: sessionData, error: sessionError } = await supabase
        .from('study_sessions')
        .insert({
          child_id: childId,
          genre_id: genre.id,
          mode,
          total_questions: questions.length,
          correct_count: correctCount,
          earned_points: pointsResult.totalPoints,
          completed_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (sessionError || !sessionData) throw sessionError;

      const historyToInsert = historyRecords.map((record) => ({
        session_id: sessionData.id,
        child_id: childId,
        question_id: record.question_id,
        is_correct: record.is_correct,
        selected_index: record.selected_index,
      }));

      const { error: historyError } = await supabase.from('study_history').insert(historyToInsert);
      if (historyError) throw historyError;

      if (pointsResult.totalPoints > 0) {
        const pointTransactions: { child_id: string; session_id: string; points: number; reason: string }[] = [];

        if (pointsResult.basePoints > 0) {
          pointTransactions.push({
            child_id: childId,
            session_id: sessionData.id,
            points: pointsResult.basePoints,
            reason: 'correct_answer',
          });
        }

        if (pointsResult.bonusPoints > 0) {
          pointTransactions.push({
            child_id: childId,
            session_id: sessionData.id,
            points: pointsResult.bonusPoints,
            reason: 'perfect_bonus',
          });
        }

        const { error: pointError } = await supabase.from('point_transactions').insert(pointTransactions);
        if (pointError) {
          console.error('Failed to save point transactions:', pointError);
        }

        const { data: childData } = await supabase
          .from('child_profiles')
          .select('total_points')
          .eq('id', childId)
          .single();

        if (childData) {
          const { error: updateError } = await supabase
            .from('child_profiles')
            .update({ total_points: (childData.total_points || 0) + pointsResult.totalPoints })
            .eq('id', childId);
          if (updateError) {
            console.error('Failed to update child points:', updateError);
          }
        }
      }

      router.push(`/result?session_id=${sessionData.id}`);
    } catch (err) {
      console.error('Failed to save session:', err);
      alert('結果の保存に失敗しました。');
      setIsSubmitting(false);
    }
  };

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
          {mode === 'review' ? '苦手な問題はありません。すばらしい！' : 'このジャンルには問題がありません。'}
        </p>
        {mode === 'review' && (
          <div className="inline-flex items-center gap-2 text-lg font-black text-teal-700 sm:text-xl">
            <Sparkles className={ICON_SIZE.sm} strokeWidth={ICON_STROKE.strong} />
            よくできました
          </div>
        )}
        <button
          className="mt-4 min-h-11 rounded-full border-4 border-zinc-400 bg-teal-300 px-8 py-3 text-xl font-black text-zinc-900 shadow-brutal transition-all hover:-translate-y-1 hover:bg-teal-400 hover:shadow-brutal-lg active-brutal-push"
          onClick={() => router.push('/dashboard')}
        >
          戻る
        </button>
      </div>
    );
  }

  const progressValue = ((currentIndex + 1) / questions.length) * 100;
  const isCurrentCorrect = selectedOption === currentQuestion.correct_index;

  return (
    <div className="flex h-full flex-1 flex-col gap-4">
      <div className="rounded-2xl border-4 border-zinc-400 bg-white p-4 shadow-brutal-sm">
        <div className="mb-2 flex items-center justify-between text-sm font-black text-zinc-700">
          <span>
            {currentIndex + 1} / {questions.length} 問
          </span>
          <span>{correctCount} 問正解</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full border-2 border-zinc-300 bg-zinc-100">
          <div className={`h-full ${tone.progress}`} style={{ width: `${progressValue}%` }} />
        </div>
      </div>

      <div className="rounded-3xl border-4 border-zinc-400 bg-white p-5 shadow-brutal sm:p-8">
        <p className="text-[clamp(1.25rem,5vw,2rem)] font-black text-zinc-900">{currentQuestion.question_text}</p>
      </div>

      <div className="grid gap-3">
        {currentQuestion.options.map((option, index) => {
          const isSelected = selectedOption === index;
          const isCorrect = currentQuestion.correct_index === index;
          let classes = 'border-zinc-400 bg-white hover:bg-zinc-50';

          if (isAnswered) {
            if (isCorrect) classes = 'border-teal-500 bg-teal-100';
            else if (isSelected) classes = 'border-rose-500 bg-rose-100';
            else classes = 'border-zinc-300 bg-zinc-100';
          }

          return (
            <button
              key={index}
              onClick={() => handleOptionClick(index)}
              disabled={isAnswered}
              className={`w-full rounded-2xl border-4 p-4 text-left text-lg font-black shadow-brutal-sm transition-all ${classes}`}
            >
              <span className="inline-flex items-center gap-2">
                {isAnswered && isCorrect && <CheckCircle className="h-5 w-5 text-teal-700" />}
                {isAnswered && isSelected && !isCorrect && <XCircle className="h-5 w-5 text-rose-700" />}
                {option}
              </span>
            </button>
          );
        })}
      </div>

      {isAnswered && (
        <div
          className={`rounded-2xl border-4 p-4 font-black ${
            isCurrentCorrect ? 'border-teal-500 bg-teal-100 text-teal-800' : 'border-rose-500 bg-rose-100 text-rose-800'
          }`}
        >
          {isCurrentCorrect ? (
            <div className="inline-flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              せいかい！
            </div>
          ) : (
            <div className="inline-flex items-center gap-2">
              <X className="h-5 w-5" />
              ざんねん！
            </div>
          )}
          {currentQuestion.explanation && <p className="mt-2 text-sm font-bold">{currentQuestion.explanation}</p>}
        </div>
      )}

      <button
        disabled={!isAnswered || isSubmitting}
        onClick={handleNext}
        className="mt-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-full border-4 border-zinc-400 bg-teal-300 px-6 py-3 text-lg font-black text-zinc-900 shadow-brutal transition-all hover:bg-teal-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {currentIndex < questions.length - 1 ? 'つぎへ' : isSubmitting ? '保存中...' : '結果を見る'}
        <ArrowRight className="h-5 w-5" />
      </button>
    </div>
  );
}
