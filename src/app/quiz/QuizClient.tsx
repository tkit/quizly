'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, CheckCircle, PartyPopper, X, XCircle } from 'lucide-react';
import { calculateSessionPoints } from '@/lib/points';
import { fireCorrectEffect } from '@/lib/effects/confetti';
import { ICON_SIZE, ICON_STROKE } from '@/lib/ui/iconTokens';
import { resolveSubjectTone } from '@/lib/ui/subjectTone';

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
  childId,
  genre,
  questions,
}: {
  childId: string;
  genre: Genre;
  questions: Question[];
}) {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOptionDisplayIndex, setSelectedOptionDisplayIndex] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [historyRecords, setHistoryRecords] = useState<{question_id: string; is_correct: boolean; selected_index: number}[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [idempotencyKey] = useState(() => `quiz-${crypto.randomUUID().replace(/-/g, '')}`);

  const currentQuestion = questions[currentIndex];

  const displayToOriginalOptionIndex = useMemo(() => {
    const indices = currentQuestion.options.map((_, index) => index);

    const buildSeed = () => {
      const source = `${childId}:${currentQuestion.id}`;
      let hash = 0;
      for (let i = 0; i < source.length; i += 1) {
        hash = (hash * 31 + source.charCodeAt(i)) >>> 0;
      }
      return hash >>> 0;
    };

    // Seeded Fisher-Yates shuffle (stable per child+question)
    let seed = buildSeed();
    const nextRand = () => {
      seed = (seed + 0x6d2b79f5) >>> 0;
      let t = seed;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    for (let i = indices.length - 1; i > 0; i -= 1) {
      const j = Math.floor(nextRand() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    return indices;
  }, [childId, currentQuestion.id, currentQuestion.options]);

  const handleOptionClick = (displayIndex: number) => {
    if (isAnswered) return;
    setSelectedOptionDisplayIndex(displayIndex);
    setIsAnswered(true);

    const selectedOriginalIndex = displayToOriginalOptionIndex[displayIndex];

    const isCorrect = selectedOriginalIndex === currentQuestion.correct_index;
    if (isCorrect) {
      setCorrectCount((prev) => prev + 1);
      void fireCorrectEffect();
    }

    setHistoryRecords((prev) => [
      ...prev,
      {
        question_id: currentQuestion.id,
        is_correct: isCorrect,
        selected_index: selectedOriginalIndex,
      },
    ]);
  };

  const handleNext = async () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedOptionDisplayIndex(null);
      setIsAnswered(false);
      return;
    }

    await saveSessionAndRedirect();
  };

  const saveSessionAndRedirect = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const pointsResult = calculateSessionPoints(correctCount, questions.length);
      const pointTransactions = [
        pointsResult.basePoints > 0
          ? {
              points: pointsResult.basePoints,
              reason: 'correct_answer',
            }
          : null,
        pointsResult.bonusPoints > 0
          ? {
              points: pointsResult.bonusPoints,
              reason: 'perfect_bonus',
            }
          : null,
      ].filter((transaction): transaction is { points: number; reason: string } => transaction !== null);

      const response = await fetch('/api/study-sessions/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          idempotencyKey,
          genreId: genre.id,
          mode: 'normal',
          totalQuestions: questions.length,
          correctCount,
          earnedPoints: pointsResult.totalPoints,
          completedAt: new Date().toISOString(),
          historyRecords,
          pointTransactions,
        }),
      });

      const body = (await response.json().catch(() => null)) as { sessionId?: string; error?: string } | null;
      if (!response.ok || !body?.sessionId) {
        throw new Error(body?.error ?? 'Failed to complete study session');
      }

      router.push(`/result?session_id=${body.sessionId}`);
    } catch (err) {
      console.error('Failed to save session:', err);
      alert('結果の保存に失敗しました。');
      setIsSubmitting(false);
    }
  };

  const tone = resolveSubjectTone(genre.parent_id ?? genre.id, genre.color_hint);

  if (questions.length === 0) {
    return (
      <div className="flex h-full flex-1 flex-col items-center justify-center gap-5 p-4 text-center sm:gap-6">
        <PartyPopper className={`${ICON_SIZE.hero} animate-bounce-soft ${tone.accentTextClass}`} strokeWidth={ICON_STROKE.regular} />
        <p className="w-full max-w-lg rounded-3xl border-4 border-zinc-400 bg-white px-5 py-4 text-[clamp(1.25rem,5.5vw,1.8rem)] font-black text-zinc-800 shadow-brutal sm:px-8">
          このジャンルには問題がありません。
        </p>
        <button
          className="mt-4 min-h-11 rounded-full border-4 border-zinc-400 bg-zinc-100 px-8 py-3 text-xl font-black text-zinc-900 shadow-brutal transition-all hover:-translate-y-1 hover:bg-zinc-200 hover:shadow-brutal-lg active-brutal-push"
          onClick={() => router.push('/dashboard')}
        >
          戻る
        </button>
      </div>
    );
  }

  const progressValue = ((currentIndex + 1) / questions.length) * 100;
  const selectedOriginalIndex =
    selectedOptionDisplayIndex == null
      ? null
      : displayToOriginalOptionIndex[selectedOptionDisplayIndex];
  const isCurrentCorrect = selectedOriginalIndex === currentQuestion.correct_index;

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
          <div className={`h-full ${tone.progressClass}`} style={{ width: `${progressValue}%` }} />
        </div>
      </div>

      <div className="rounded-3xl border-4 border-zinc-400 bg-white p-5 shadow-brutal sm:p-8">
        <p className="text-[clamp(1.25rem,5vw,2rem)] font-black text-zinc-900">{currentQuestion.question_text}</p>
      </div>

      <div className="grid gap-3">
        {displayToOriginalOptionIndex.map((originalIndex, displayIndex) => {
          const option = currentQuestion.options[originalIndex];
          const isSelected = selectedOptionDisplayIndex === displayIndex;
          const isCorrect = currentQuestion.correct_index === originalIndex;
          let classes = 'border-zinc-400 bg-white hover:bg-zinc-50';

          if (isAnswered) {
            if (isCorrect) classes = tone.correctClass;
            else if (isSelected) classes = 'border-rose-500 bg-rose-100';
            else classes = 'border-zinc-300 bg-zinc-100';
          }

          return (
            <button
              key={displayIndex}
              onClick={() => handleOptionClick(displayIndex)}
              disabled={isAnswered}
              className={`w-full rounded-2xl border-4 p-4 text-left text-lg font-black shadow-brutal-sm transition-all ${classes}`}
            >
              <span className="inline-flex items-center gap-2">
                {isAnswered && isCorrect && <CheckCircle className={`h-5 w-5 ${tone.successSignalClass}`} />}
                {isAnswered && isSelected && !isCorrect && <XCircle className="h-5 w-5 text-rose-700" />}
                {option}
                {isAnswered && isCorrect && (
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-black ${tone.successChipClass}`}>正解</span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {isAnswered && (
        <div
          className={`rounded-2xl border-4 p-4 font-black ${
            isCurrentCorrect ? tone.correctClass : 'border-rose-500 bg-rose-100 text-rose-800'
          }`}
        >
          {isCurrentCorrect ? (
            <div className="inline-flex items-center gap-2">
              <CheckCircle className={`h-5 w-5 ${tone.successSignalClass}`} />
              <span className={`rounded-full border px-2.5 py-0.5 text-sm font-black ${tone.successChipClass}`}>せいかい！</span>
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
        className="mt-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-full border-4 border-zinc-400 bg-zinc-100 px-6 py-3 text-lg font-black text-zinc-900 shadow-brutal transition-all hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {currentIndex < questions.length - 1 ? 'つぎへ' : isSubmitting ? '保存中...' : '結果を見る'}
        <ArrowRight className="h-5 w-5" />
      </button>
    </div>
  );
}
