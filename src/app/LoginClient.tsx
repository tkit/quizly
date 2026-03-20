'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ArrowRight, CircleAlert, CircleUserRound, Pencil } from 'lucide-react';
import { updateUserAvatar } from './actions';
import { ICON_SIZE, ICON_STROKE } from '@/lib/ui/iconTokens';
import { supabase } from '@/lib/supabase';

interface User {
  id: string;
  name: string;
  icon_url: string | null;
  pin_code_hash: string;
}

const AVATARS = [
  '/avatars/avatar_dog.png',
  '/avatars/avatar_cat.png',
  '/avatars/avatar_bear.png',
  '/avatars/avatar_rabbit.png',
  '/avatars/avatar_lion.png',
  '/avatars/avatar_penguin.png',
  '/avatars/avatar_owl.png',
  '/avatars/avatar_robot.png',
];

export default function LoginClient({ users }: { users: User[] }) {
  const router = useRouter();
  const [usersState, setUsersState] = useState<User[]>(users);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [usersErrorMsg, setUsersErrorMsg] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  
  const [editingAvatarUser, setEditingAvatarUser] = useState<User | null>(null);
  const [isUpdatingAvatar, setIsUpdatingAvatar] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const fetchUsers = async () => {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: true });

      if (!isMounted) {
        return;
      }

      if (error) {
        setUsersErrorMsg('ユーザーを読み込めませんでした');
      } else {
        setUsersState(data ?? []);
      }

      setIsLoadingUsers(false);
    };

    fetchUsers();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleUserClick = (user: User) => {
    setSelectedUser(user);
    setPinInput('');
    setErrorMsg('');
  };

  const handlePinSubmit = () => {
    if (!selectedUser) return;
    
    // In a real app we'd verify the hash, but for now we just assume the entered pin is correct 
    if (pinInput === selectedUser.pin_code_hash) {
      localStorage.setItem('quizly_user_id', selectedUser.id);
      localStorage.setItem('quizly_user_name', selectedUser.name);
      router.push('/dashboard');
    } else {
      setErrorMsg('あんしょうばんごうがちがいます！');
      setPinInput('');
    }
  };

  const handleAvatarSelect = async (avatarUrl: string) => {
    if (!editingAvatarUser) return;
    setIsUpdatingAvatar(true);
    await updateUserAvatar(editingAvatarUser.id, avatarUrl);
    setUsersState((prev) =>
      prev.map((user) =>
        user.id === editingAvatarUser.id ? { ...user, icon_url: avatarUrl } : user
      )
    );
    setIsUpdatingAvatar(false);
    setEditingAvatarUser(null);
  };

  return (
    <>
      <div className="grid w-full grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:gap-5 md:grid-cols-3">
        {isLoadingUsers && (
          <div className="col-span-full text-center bg-white p-8 border-4 border-dashed border-zinc-300 rounded-3xl">
            <p className="text-xl font-bold text-zinc-500">ユーザーを読み込み中...</p>
          </div>
        )}
        {!isLoadingUsers && usersErrorMsg && (
          <div className="col-span-full text-center bg-red-50 p-8 border-4 border-red-300 rounded-3xl">
            <p className="text-xl font-bold text-red-700 inline-flex items-center gap-2">
              <CircleAlert className={ICON_SIZE.md} strokeWidth={ICON_STROKE.regular} />
              {usersErrorMsg}
            </p>
          </div>
        )}
        {!isLoadingUsers && !usersErrorMsg && usersState.map((user) => (
          <div 
            key={user.id} 
            className="group relative"
          >
            <div
              onClick={() => handleUserClick(user)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === 'Space') {
                   handleUserClick(user);
                }
              }}
              role="button"
              tabIndex={0}
              className="relative h-full w-full cursor-pointer rounded-3xl border-4 border-zinc-400 bg-white p-4 text-left shadow-brutal transition-all hover:-translate-y-1 hover:shadow-brutal-lg active-brutal-push focus:ring-4 focus:ring-teal-500 focus:outline-none sm:p-6"
            >
              <div className="relative flex flex-col items-center gap-3 pointer-events-none sm:gap-4">
                {/* Avatar circle */}
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-4 border-zinc-400 bg-slate-100 shadow-brutal-sm transition-colors pointer-events-auto group-hover:bg-teal-200 sm:h-24 sm:w-24">
                  {user.icon_url?.startsWith('/') ? (
                    <Image
                      src={user.icon_url}
                      alt={user.name}
                      width={96}
                      height={96}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    user.icon_url ? (
                      <span className="text-4xl sm:text-5xl">{user.icon_url}</span>
                    ) : (
                      <CircleUserRound className={`${ICON_SIZE.xl} text-zinc-600`} strokeWidth={ICON_STROKE.regular} />
                    )
                  )}
                </div>
                
                {/* Name Badge */}
                <span className="rounded-full border-2 border-zinc-400 bg-slate-100 px-4 py-1 text-[clamp(1rem,4.8vw,1.25rem)] font-bold text-zinc-800">
                  {user.name}
                </span>

                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute -right-2 -top-2 h-11 w-11 rounded-full border-2 border-zinc-400 bg-slate-100 p-0 text-teal-700 shadow-brutal-sm pointer-events-auto hover:bg-slate-200 hover:text-teal-800 active-brutal-push"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingAvatarUser(user);
                  }}
                >
                  <Pencil className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
        {!isLoadingUsers && !usersErrorMsg && usersState.length === 0 && (
          <div className="col-span-full text-center bg-white p-8 border-4 border-dashed border-zinc-300 rounded-3xl">
            <p className="text-xl font-bold text-zinc-500 inline-flex items-center gap-2">
              <CircleAlert className={ICON_SIZE.md} strokeWidth={ICON_STROKE.regular} />
              ユーザーが いません
            </p>
          </div>
        )}
      </div>

      {/* PIN Dialog */}
      <Dialog open={!!selectedUser} onOpenChange={(open) => {
        if (!open) setSelectedUser(null);
      }}>
        <DialogContent className="!left-4 !right-4 !w-auto !max-w-none !translate-x-0 max-h-[calc(100dvh-1.5rem)] overflow-x-hidden overflow-y-auto rounded-[2.5rem] border-4 border-zinc-400 bg-slate-50 p-0 shadow-brutal-lg sm:!left-1/2 sm:!right-auto sm:!w-full sm:!max-w-sm sm:!translate-x-[-50%] sm:max-h-[min(92dvh,760px)]">
          {/* Fun header */}
          <div className="relative border-b-4 border-zinc-400 bg-teal-500 p-5 text-center sm:p-6">
            <div className="absolute top-2 left-2 w-4 h-4 rounded-full bg-white/50" />
            <div className="absolute bottom-2 right-4 w-6 h-6 rounded-full bg-white/20" />
            <h2 className="text-[clamp(1.3rem,6vw,1.55rem)] font-black text-white drop-shadow-[2px_2px_0_rgba(24,24,27,1)]">
              {selectedUser?.name}さんの
            </h2>
            <h3 className="text-[clamp(1rem,4.5vw,1.25rem)] font-bold text-teal-200 drop-shadow-[1px_1px_0_rgba(24,24,27,1)]">
              あんしょうばんごう
            </h3>
          </div>

          <div className="flex flex-col items-center gap-4 bg-slate-50 p-4 sm:gap-6 sm:p-6">
            <div className="w-full rounded-2xl border-4 border-zinc-400 bg-white px-4 py-2 text-center shadow-brutal-sm">
              <p className="text-sm font-black text-zinc-600 sm:text-base">4けたの数字を入力してください</p>
            </div>

            {/* PIN Display */}
            <div className="flex min-h-[4.5rem] w-full items-center justify-center rounded-2xl border-4 border-zinc-400 bg-white p-3 shadow-inner sm:h-20 sm:p-4">
              <div className="flex gap-2 sm:gap-3">
                {[0, 1, 2, 3].map((index) => (
                  <div key={index} className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-zinc-400 bg-zinc-100">
                    {index < pinInput.length && (
                      <div className="w-4 h-4 bg-zinc-800 rounded-full animate-bounce-soft" />
                    )}
                  </div>
                ))}
              </div>
            </div>
            
            {errorMsg && (
              <div className="bg-red-100 border-2 border-red-500 rounded-xl px-4 py-2 w-full text-center animate-wiggle">
                <p className="text-red-700 font-bold">{errorMsg}</p>
              </div>
            )}

            {/* Chunky Keypad */}
            <div className="grid w-full grid-cols-3 gap-2 sm:gap-3">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  className="h-12 rounded-2xl border-4 border-zinc-400 bg-white text-xl font-black text-teal-700 shadow-brutal hover:bg-slate-50 active-brutal-push focus:ring-2 focus:ring-teal-500 focus:outline-none sm:h-16 sm:text-3xl"
                  onClick={() => {
                    if (pinInput.length < 4) setPinInput(prev => prev + num);
                  }}
                >
                  {num}
                </button>
              ))}
              <div />
              <button
                className="h-12 rounded-2xl border-4 border-zinc-400 bg-white text-xl font-black text-teal-700 shadow-brutal hover:bg-slate-50 active-brutal-push focus:ring-2 focus:ring-teal-500 focus:outline-none sm:h-16 sm:text-3xl"
                onClick={() => {
                  if (pinInput.length < 4) setPinInput(prev => prev + '0');
                }}
              >
                0
              </button>
              <button
                className="h-12 rounded-2xl border-4 border-zinc-400 bg-slate-100 text-sm font-bold text-teal-700 shadow-brutal hover:bg-teal-200 active-brutal-push focus:ring-2 focus:ring-teal-500 focus:outline-none sm:h-16 sm:text-lg"
                onClick={() => setPinInput(prev => prev.slice(0, -1))}
              >
                けす
              </button>
            </div>

            <button 
              className="mt-1 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border-4 border-zinc-400 bg-teal-400 py-3 text-xl font-black text-zinc-900 shadow-brutal transition-all hover:bg-teal-500 active-brutal-push disabled:opacity-50 disabled:hover:bg-teal-400 disabled:active:translate-x-0 disabled:active:translate-y-0 disabled:active:shadow-brutal sm:mt-2 sm:py-4 sm:text-2xl"
              disabled={pinInput.length !== 4}
              onClick={handlePinSubmit}
            >
              つぎへ
              <ArrowRight className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Avatar Selection Dialog */}
      <Dialog open={!!editingAvatarUser} onOpenChange={(open) => {
        if (!open) setEditingAvatarUser(null);
      }}>
        <DialogContent className="!left-4 !right-4 !w-auto !max-w-none !translate-x-0 max-h-[calc(100dvh-1.5rem)] overflow-x-hidden overflow-y-auto rounded-[2.5rem] border-4 border-zinc-400 bg-slate-50 p-4 shadow-brutal-lg sm:!left-1/2 sm:!right-auto sm:!w-full sm:!max-w-md sm:!translate-x-[-50%] sm:max-h-[min(92dvh,760px)] sm:p-6">
          <DialogHeader>
            <DialogTitle className="mb-3 text-center text-[clamp(1.4rem,6vw,1.9rem)] font-black text-teal-600 drop-shadow-[2px_2px_0_rgba(24,24,27,1)] sm:mb-4">
              アバターをえらぶ
            </DialogTitle>
          </DialogHeader>

          <div className="mb-4 rounded-2xl border-4 border-zinc-400 bg-white px-4 py-2 text-center shadow-brutal-sm">
            <p className="text-sm font-black text-zinc-600 sm:text-base">好きなアイコンを1つ選んでください</p>
          </div>

          <div className="bg-accent-soft grid grid-cols-3 gap-2 rounded-[2rem] border-4 border-zinc-400 p-3 shadow-inner min-[420px]:grid-cols-4 sm:gap-3 sm:p-4">
            {AVATARS.map((avatar) => (
              <button
                key={avatar}
                disabled={isUpdatingAvatar}
                onClick={() => handleAvatarSelect(avatar)}
                className="aspect-square min-h-11 overflow-hidden rounded-2xl border-4 border-transparent bg-slate-100 transition-all group hover:border-zinc-400 hover:shadow-brutal active-brutal-push disabled:opacity-50"
              >
                <Image
                  src={avatar}
                  alt="avatar option"
                  width={80}
                  height={80}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                />
              </button>
            ))}
          </div>

          <div className="mt-5 flex justify-center sm:mt-6">
            <button 
              className="min-h-11 rounded-full border-4 border-zinc-400 bg-white px-8 py-2 font-bold text-zinc-500 shadow-brutal hover:bg-zinc-100 active-brutal-push disabled:opacity-50 sm:py-3"
              onClick={() => setEditingAvatarUser(null)}
              disabled={isUpdatingAvatar}
            >
              やめる
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
