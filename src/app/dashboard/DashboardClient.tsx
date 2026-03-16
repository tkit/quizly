'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LogOut, Star } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Genre {
  id: string;
  name: string;
  icon: string | null;
  description: string | null;
  color_hint: string | null;
}

export default function DashboardClient({ genres }: { genres: Genre[] }) {
  const router = useRouter();
  const [userName, setUserName] = useState<string | null>(null);
  const [totalPoints, setTotalPoints] = useState<number>(0);

  useEffect(() => {
    // Check if user is logged in
    const userId = localStorage.getItem('quizly_user_id');
    const storedName = localStorage.getItem('quizly_user_name');
    
    if (!userId) {
      router.push('/');
    } else {
      setUserName(storedName);
      // Fetch total points
      supabase
        .from('users')
        .select('total_points')
        .eq('id', userId)
        .single()
        .then(({ data }) => {
          if (data?.total_points != null) {
            setTotalPoints(data.total_points);
          }
        });
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('quizly_user_id');
    localStorage.removeItem('quizly_user_name');
    router.push('/');
  };

  const handleGenreClick = (genreId: string) => {
    router.push(`/setup?genre=${genreId}`);
  };

  if (!userName) {
    return null; // or a loading spinner
  }

  return (
    <div className="flex flex-col gap-8 w-full max-w-4xl mx-auto p-4 sm:p-8">
      {/* Playful Header */}
      <header className="flex justify-between items-center bg-white p-4 sm:p-6 rounded-[2rem] border-4 border-zinc-400 shadow-brutal w-full">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 sm:w-16 sm:h-16 bg-yellow-300 rounded-full flex items-center justify-center text-3xl font-black text-zinc-900 border-4 border-zinc-400 shadow-brutal-sm animate-bounce-soft">
            {userName.charAt(0)}
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-zinc-800 tracking-wide">{userName}さんのトップページ</h1>
            <p className="text-md sm:text-lg font-bold text-pink-500 mt-1">きょうも がんばろう！✨</p>
          </div>
        </div>
        <button 
          onClick={handleLogout} 
          className="p-3 bg-red-100 rounded-2xl border-4 border-zinc-400 shadow-brutal text-red-600 hover:bg-red-200 active-brutal-push focus:outline-none focus:ring-4 focus:ring-red-400 group transition-colors"
          title="ログアウト"
        >
          <LogOut className="h-6 w-6 group-hover:-translate-x-1 group-hover:scale-110 transition-transform" />
        </button>
      </header>

      {/* Points Badge */}
      <div className="flex justify-center -mt-4">
        <div className="inline-flex items-center gap-3 bg-gradient-to-r from-amber-100 to-yellow-200 px-8 py-3 rounded-full border-4 border-amber-400 shadow-brutal transform rotate-1 hover:-rotate-1 transition-transform">
          <Star className="w-7 h-7 text-amber-500 fill-amber-400" />
          <span className="text-xl sm:text-2xl font-black text-amber-800">
            もっているポイント
          </span>
          <span className="text-3xl sm:text-4xl font-black text-amber-600 tabular-nums">
            {totalPoints.toLocaleString()}
          </span>
          <span className="text-xl sm:text-2xl font-black text-amber-800">pt</span>
        </div>
      </div>

      {/* Genres Section */}
      <section className="flex flex-col gap-6 w-full">
        <h2 className="text-2xl font-black text-zinc-800 bg-white inline-block px-6 py-2 rounded-full border-4 border-zinc-400 shadow-brutal w-fit transform -rotate-1">
          がくしゅうを おこなう！
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
          {genres.map((genre) => {
            // Determine playful colors based on hint
            let baseColorClass = 'bg-blue-100 hover:bg-blue-200 text-blue-800';
            let iconBgClass = 'bg-blue-300';
            
            if (genre.color_hint === 'orange') {
              baseColorClass = 'bg-orange-100 hover:bg-orange-200 text-orange-800';
              iconBgClass = 'bg-orange-300';
            } else if (genre.color_hint === 'green') {
              baseColorClass = 'bg-green-100 hover:bg-green-200 text-green-800';
              iconBgClass = 'bg-green-300';
            } else if (genre.color_hint === 'pink') {
              baseColorClass = 'bg-pink-100 hover:bg-pink-200 text-pink-800';
              iconBgClass = 'bg-pink-300';
            } else if (genre.color_hint === 'purple') {
              baseColorClass = 'bg-purple-100 hover:bg-purple-200 text-purple-800';
              iconBgClass = 'bg-purple-300';
            }

            return (
              <button
                key={genre.id}
                onClick={() => handleGenreClick(genre.id)}
                className={`w-full text-left rounded-[2rem] border-4 border-zinc-400 shadow-brutal hover:-translate-y-2 hover:shadow-brutal-lg transition-all active-brutal-push focus:outline-none focus:ring-4 focus:ring-blue-400 p-6 flex items-center gap-6 group overflow-hidden relative ${baseColorClass}`}
              >
                {/* Background Decoration */}
                <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/20 rounded-full transform group-hover:scale-150 transition-transform duration-500" />
                
                {/* Chunk Icon */}
                <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-[1.5rem] flex items-center justify-center text-5xl border-4 border-zinc-400 shadow-brutal-sm z-10 group-hover:rotate-6 group-hover:scale-110 transition-all ${iconBgClass}`}>
                  {genre.icon || '📚'}
                </div>
                
                {/* Text Content */}
                <div className="flex-1 z-10">
                  <h3 className="text-2xl sm:text-3xl font-black mb-2 tracking-wide drop-shadow-sm">{genre.name}</h3>
                  <p className="text-md sm:text-lg font-bold opacity-80">{genre.description}</p>
                </div>
                
                {/* Arrow */}
                <div className="text-5xl font-black opacity-30 group-hover:opacity-100 group-hover:translate-x-2 transition-all z-10">
                  →
                </div>
              </button>
            );
          })}
          
          {genres.length === 0 && (
             <div className="col-span-full p-12 text-center bg-white border-4 border-dashed border-zinc-400 rounded-[2rem] shadow-brutal">
               <p className="text-2xl font-bold text-zinc-500">ジャンルが まだありません 😢</p>
             </div>
          )}
        </div>
      </section>

      {/* History Placeholder */}
      <section className="mt-4 bg-yellow-300 p-6 rounded-[2rem] border-4 border-zinc-400 shadow-brutal transform rotate-1 w-full max-w-2xl mx-auto">
        <div className="flex flex-col gap-2 items-center text-center">
           <h2 className="text-2xl font-black text-zinc-900 bg-white px-6 py-2 rounded-xl border-4 border-zinc-400 shadow-brutal-sm -rotate-2">
             これまでのきろく
           </h2>
           <p className="text-xl font-bold text-zinc-800 mt-2">（※いまはまだ じゅんび中だよ！🚧）</p>
        </div>
      </section>
    </div>
  );
}

