'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';

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

  useEffect(() => {
    // Check if user is logged in
    const userId = localStorage.getItem('quizly_user_id');
    const storedName = localStorage.getItem('quizly_user_name');
    
    if (!userId) {
      router.push('/');
    } else {
      setUserName(storedName);
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
    <div className="flex flex-col gap-8 w-full">
      <header className="flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-2xl font-bold text-blue-500">
            {userName.charAt(0)}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{userName}さんのトップページ</h1>
            <p className="text-zinc-500 text-sm">きょうもがんばろう！</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={handleLogout} className="text-zinc-400 hover:text-red-500">
          <LogOut className="h-6 w-6" />
        </Button>
      </header>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-bold text-zinc-700">がくしゅうをはじめる</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {genres.map((genre) => (
            <Card 
              key={genre.id}
              className={`cursor-pointer border-2 transition-all hover:scale-[1.02] active:scale-95 touch-manipulation overflow-hidden rounded-3xl ${
                genre.color_hint === 'blue' ? 'border-blue-200 hover:border-blue-500 hover:shadow-blue-100' :
                genre.color_hint === 'orange' ? 'border-orange-200 hover:border-orange-500 hover:shadow-orange-100' :
                genre.color_hint === 'green' ? 'border-green-200 hover:border-green-500 hover:shadow-green-100' :
                'border-zinc-200 hover:border-zinc-500 hover:shadow-zinc-100'
              } hover:-translate-y-1 shadow-sm`}
              onClick={() => handleGenreClick(genre.id)}
            >
              <CardContent className="p-6 flex items-center gap-6">
                <div className={`w-20 h-20 rounded-2xl flex items-center justify-center text-4xl shadow-inner ${
                  genre.color_hint === 'blue' ? 'bg-blue-100 text-blue-600' :
                  genre.color_hint === 'orange' ? 'bg-orange-100 text-orange-600' :
                  genre.color_hint === 'green' ? 'bg-green-100 text-green-600' :
                  'bg-zinc-100 text-zinc-600'
                }`}>
                  {genre.icon || '📚'}
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold mb-1">{genre.name}</h3>
                  <p className="text-zinc-500 text-sm">{genre.description}</p>
                </div>
                <div className={`text-3xl font-bold opacity-20 ${
                   genre.color_hint === 'blue' ? 'text-blue-500' :
                   genre.color_hint === 'orange' ? 'text-orange-500' :
                   genre.color_hint === 'green' ? 'text-green-500' :
                   'text-zinc-400'
                }`}>
                  →
                </div>
              </CardContent>
            </Card>
          ))}
          {genres.length === 0 && (
             <div className="col-span-full p-8 text-center text-zinc-500 border-2 border-dashed rounded-3xl">
               ジャンルが登録されていません。
             </div>
          )}
        </div>
      </section>

      <section className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-3xl shadow-sm border border-blue-100">
        <div className="flex flex-col gap-2">
           <h2 className="text-lg font-bold text-blue-800">これまでの記録</h2>
           <p className="text-blue-600/80">（※履歴機能は準備中だよ！）</p>
        </div>
      </section>
    </div>
  );
}
