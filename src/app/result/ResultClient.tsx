'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Home, RotateCcw } from 'lucide-react';

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
  mode: string;
  genres: {
    name: string;
    icon: string;
    color_hint: string;
  } | null;
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

  const targetColor =
    session.genres?.color_hint === 'blue' ? 'blue' :
    session.genres?.color_hint === 'orange' ? 'orange' :
    session.genres?.color_hint === 'green' ? 'green' : 'zinc';

  return (
    <div className="flex flex-col gap-8 h-full">
      <div className={`p-8 rounded-[2rem] text-center border-4 shadow-xl ${
        isPerfect 
          ? 'bg-amber-100 border-amber-400' 
          : isGood 
            ? 'bg-blue-50 border-blue-400'
            : 'bg-white border-zinc-200'
      }`}>
        <div className="text-6xl mb-4 animate-bounce">
          {isPerfect ? '🏆' : isGood ? '👏' : '👍'}
        </div>
        <h1 className="text-4xl font-black mb-2 text-zinc-800">
          {isPerfect ? 'パーフェクト！！' : isGood ? 'すばらしい！' : 'よくがんばったね！'}
        </h1>
        <p className="text-2xl font-bold text-zinc-600 mb-6">
          {session.total_questions}問中 <span className={`text-4xl ${isPerfect ? 'text-amber-600' : 'text-blue-600'}`}>{session.correct_count}</span> 問せいかい
        </p>

        <div className="flex justify-center gap-4 mt-8 flex-wrap">
          <Button 
            variant="outline"
            className="h-14 px-6 rounded-full text-lg border-2 border-zinc-300 hover:bg-zinc-100"
            onClick={() => router.push('/dashboard')}
          >
            <Home className="mr-2" /> ダッシュボードへ
          </Button>
          <Button 
            className={`h-14 px-6 rounded-full text-lg font-bold text-white shadow-md ${
               targetColor === 'blue' ? 'bg-blue-600 hover:bg-blue-700' :
               targetColor === 'orange' ? 'bg-orange-500 hover:bg-orange-600' :
               targetColor === 'green' ? 'bg-green-500 hover:bg-green-600' :
               'bg-zinc-800 hover:bg-zinc-900'
            }`}
            onClick={() => router.push(`/setup?genre=${session.genre_id}`)}
          >
            <RotateCcw className="mr-2" /> もういちど設定へ
          </Button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl shadow-sm border border-zinc-100">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <span>📝</span> 振り返り
        </h2>
        <div className="flex flex-col gap-4">
          {history.map((record, index) => {
            const q = Array.isArray(record.questions) ? record.questions[0] : record.questions;
            if (!q) return null;
            return (
              <div key={index} className={`p-4 rounded-2xl border-l-8 flex flex-col gap-3 ${
                record.is_correct ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'
              }`}>
                <div className="flex gap-3">
                   {record.is_correct ? (
                      <CheckCircle className="w-6 h-6 shrink-0 text-green-500" />
                   ) : (
                      <XCircle className="w-6 h-6 shrink-0 text-red-500" />
                   )}
                   <p className="font-bold text-zinc-800 text-lg leading-tight flex-1">
                      {index + 1}. {q.question_text}
                   </p>
                </div>

                <div className="ml-9 text-sm">
                   {!record.is_correct && (
                     <div className="mb-2">
                       <span className="text-red-600 font-bold bg-red-100 px-2 py-1 rounded-md">あなたの答え:</span>
                       <span className="ml-2 text-zinc-600">{q.options[record.selected_index]}</span>
                     </div>
                   )}
                   <div>
                     <span className="text-green-700 font-bold bg-green-200 px-2 py-1 rounded-md">正解:</span>
                     <span className="ml-2 font-bold text-zinc-800">{q.options[q.correct_index]}</span>
                   </div>
                   
                   {q.explanation && (
                     <div className="mt-3 p-3 bg-white/60 rounded-xl text-zinc-700 leading-relaxed border border-white">
                        {q.explanation}
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
