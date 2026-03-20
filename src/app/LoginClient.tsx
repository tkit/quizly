'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Pencil } from 'lucide-react';
import { updateUserAvatar } from './actions';

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
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  
  const [editingAvatarUser, setEditingAvatarUser] = useState<User | null>(null);
  const [isUpdatingAvatar, setIsUpdatingAvatar] = useState(false);

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
    setIsUpdatingAvatar(false);
    setEditingAvatarUser(null);
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:gap-6 sm:grid-cols-3 w-full">
        {users.map((user) => (
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
              className="w-full h-full text-left bg-white rounded-3xl border-4 border-zinc-400 shadow-brutal hover:-translate-y-1 hover:shadow-brutal-lg transition-all active-brutal-push focus:outline-none focus:ring-4 focus:ring-blue-400 p-4 sm:p-6 cursor-pointer relative"
            >
              <div className="flex flex-col items-center gap-4 relative pointer-events-none">
                {/* Avatar circle */}
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-yellow-100 flex items-center justify-center overflow-hidden border-4 border-zinc-400 shadow-brutal-sm group-hover:bg-yellow-200 transition-colors pointer-events-auto">
                  {user.icon_url?.startsWith('/') ? (
                    <Image
                      src={user.icon_url}
                      alt={user.name}
                      width={96}
                      height={96}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-4xl sm:text-5xl">{user.icon_url || '👤'}</span>
                  )}
                </div>
                
                {/* Name Badge */}
                <span className="text-lg sm:text-xl font-bold text-zinc-800 bg-pink-100 px-4 py-1 rounded-full border-2 border-zinc-400">
                  {user.name}
                </span>

                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute -top-2 -right-2 w-10 h-10 rounded-full bg-blue-100 border-2 border-zinc-400 shadow-brutal-sm text-blue-600 hover:bg-blue-200 hover:text-blue-700 active-brutal-push p-0 pointer-events-auto"
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
        {users.length === 0 && (
          <div className="col-span-full text-center bg-white p-8 border-4 border-dashed border-zinc-300 rounded-3xl">
            <p className="text-xl font-bold text-zinc-500">ユーザーが いません 😢</p>
          </div>
        )}
      </div>

      {/* PIN Dialog */}
      <Dialog open={!!selectedUser} onOpenChange={(open) => {
        if (!open) setSelectedUser(null);
      }}>
        <DialogContent className="sm:max-w-sm rounded-[2.5rem] p-0 overflow-hidden border-4 border-zinc-400 shadow-brutal-lg bg-emerald-50 max-h-[90vh]">
          {/* Fun header */}
          <div className="bg-blue-400 p-6 border-b-4 border-zinc-400 text-center relative">
            <div className="absolute top-2 left-2 w-4 h-4 rounded-full bg-white/50" />
            <div className="absolute bottom-2 right-4 w-6 h-6 rounded-full bg-white/20" />
            <h2 className="text-2xl font-black text-white drop-shadow-[2px_2px_0_rgba(24,24,27,1)]">
              {selectedUser?.name}さんの
            </h2>
            <h3 className="text-xl font-bold text-yellow-200 drop-shadow-[1px_1px_0_rgba(24,24,27,1)]">
              あんしょうばんごう
            </h3>
          </div>

          <div className="p-6 flex flex-col items-center gap-6 bg-emerald-50">
            {/* PIN Display */}
            <div className="w-full bg-white border-4 border-zinc-400 rounded-2xl p-4 flex justify-center items-center shadow-inner h-20">
              <div className="flex gap-3">
                {[0, 1, 2, 3].map((index) => (
                  <div key={index} className="w-6 h-6 rounded-full border-2 border-zinc-400 flex items-center justify-center bg-zinc-100">
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
            <div className="grid grid-cols-3 gap-3 w-full">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  className="h-16 text-3xl font-black rounded-2xl bg-white border-4 border-zinc-400 shadow-brutal text-blue-600 hover:bg-blue-50 active-brutal-push focus:outline-none focus:ring-2 focus:ring-blue-400"
                  onClick={() => {
                    if (pinInput.length < 4) setPinInput(prev => prev + num);
                  }}
                >
                  {num}
                </button>
              ))}
              <div />
              <button
                className="h-16 text-3xl font-black rounded-2xl bg-white border-4 border-zinc-400 shadow-brutal text-blue-600 hover:bg-blue-50 active-brutal-push focus:outline-none focus:ring-2 focus:ring-blue-400"
                onClick={() => {
                  if (pinInput.length < 4) setPinInput(prev => prev + '0');
                }}
              >
                0
              </button>
              <button
                className="h-16 text-lg font-bold rounded-2xl bg-pink-100 border-4 border-zinc-400 shadow-brutal text-pink-700 hover:bg-pink-200 active-brutal-push focus:outline-none focus:ring-2 focus:ring-pink-400"
                onClick={() => setPinInput(prev => prev.slice(0, -1))}
              >
                けす
              </button>
            </div>

            <button 
              className="w-full py-4 text-2xl font-black rounded-full bg-yellow-400 border-4 border-zinc-400 shadow-brutal text-zinc-900 hover:bg-yellow-500 active-brutal-push disabled:opacity-50 disabled:active:shadow-brutal disabled:active:translate-x-0 disabled:active:translate-y-0 disabled:hover:bg-yellow-400 transition-all mt-2"
              disabled={pinInput.length !== 4}
              onClick={handlePinSubmit}
            >
              ログイン！
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Avatar Selection Dialog */}
      <Dialog open={!!editingAvatarUser} onOpenChange={(open) => {
        if (!open) setEditingAvatarUser(null);
      }}>
        <DialogContent className="sm:max-w-md rounded-[2.5rem] p-6 border-4 border-zinc-400 shadow-brutal-lg bg-pink-50">
          <DialogHeader>
            <DialogTitle className="text-center text-3xl font-black text-pink-500 drop-shadow-[2px_2px_0_rgba(24,24,27,1)] mb-4">
              アバターをえらぶ
            </DialogTitle>
          </DialogHeader>
          
          <div className="grid grid-cols-4 gap-3 bg-white p-4 rounded-[2rem] border-4 border-zinc-400 shadow-inner">
            {AVATARS.map((avatar) => (
              <button
                key={avatar}
                disabled={isUpdatingAvatar}
                onClick={() => handleAvatarSelect(avatar)}
                className="aspect-square rounded-2xl overflow-hidden border-4 border-transparent hover:border-zinc-400 hover:shadow-brutal bg-pink-100 transition-all active-brutal-push disabled:opacity-50 group"
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

          <div className="flex justify-center mt-6">
            <button 
              className="px-8 py-3 rounded-full font-bold bg-white border-4 border-zinc-400 shadow-brutal text-zinc-500 hover:bg-zinc-100 active-brutal-push disabled:opacity-50"
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
