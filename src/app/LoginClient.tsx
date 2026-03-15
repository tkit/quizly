'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
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
      setErrorMsg('PINコードがちがいます');
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
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 w-full">
        {users.map((user) => (
          <Card 
            key={user.id} 
            className="cursor-pointer hover:border-blue-500 hover:shadow-md transition-all pt-6 pb-2 relative group"
            onClick={() => handleUserClick(user)}
          >
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 text-zinc-400 hover:bg-blue-50 hover:text-blue-600 rounded-full bg-white/50"
              onClick={(e) => {
                e.stopPropagation();
                setEditingAvatarUser(user);
              }}
            >
              <Pencil className="w-5 h-5" />
            </Button>
            
            <CardContent className="flex flex-col items-center gap-4">
              <div className="w-24 h-24 rounded-full bg-blue-50 flex items-center justify-center overflow-hidden border-4 border-white shadow-sm">
                {user.icon_url?.startsWith('/') ? (
                  <img src={user.icon_url} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-5xl">{user.icon_url || '👤'}</span>
                )}
              </div>
              <p className="text-xl font-medium">{user.name}</p>
            </CardContent>
          </Card>
        ))}
        {users.length === 0 && (
          <div className="col-span-full text-center text-zinc-500 p-8 border-2 border-dashed rounded-xl">
            ユーザーがまだ登録されていません。データベースに初期データを入れてください。
          </div>
        )}
      </div>

      <Dialog open={!!selectedUser} onOpenChange={(open) => {
        if (!open) setSelectedUser(null);
      }}>
        <DialogContent className="sm:max-w-md border-2 border-blue-100 rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-center text-2xl mb-4">
              {selectedUser?.name}さんの暗証番号
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-6">
            <div className="text-4xl font-mono tracking-[1em] h-12">
              {pinInput.padEnd(4, '・')}
            </div>
            
            {errorMsg && <p className="text-red-500 font-bold">{errorMsg}</p>}

            <div className="grid grid-cols-3 gap-4 w-full px-4">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <Button
                  key={num}
                  variant="outline"
                  className="h-16 text-2xl rounded-2xl hover:bg-blue-50 hover:text-blue-600"
                  onClick={() => {
                    if (pinInput.length < 4) setPinInput(prev => prev + num);
                  }}
                >
                  {num}
                </Button>
              ))}
              <div />
              <Button
                  variant="outline"
                  className="h-16 text-2xl rounded-2xl hover:bg-blue-50 hover:text-blue-600"
                  onClick={() => {
                    if (pinInput.length < 4) setPinInput(prev => prev + '0');
                  }}
                >
                  0
                </Button>
              <Button
                  variant="ghost"
                  className="h-16 text-lg rounded-2xl text-zinc-400"
                  onClick={() => setPinInput(prev => prev.slice(0, -1))}
                >
                  けす
                </Button>
            </div>

            <Button 
              className="w-full h-14 text-xl rounded-full bg-blue-500 hover:bg-blue-600 font-bold mt-4 text-white"
              disabled={pinInput.length !== 4}
              onClick={handlePinSubmit}
            >
              ログイン
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingAvatarUser} onOpenChange={(open) => {
        if (!open) setEditingAvatarUser(null);
      }}>
        <DialogContent className="sm:max-w-md border-2 border-blue-100 rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-center text-2xl mb-2">
              アバターをえらぶ
            </DialogTitle>
          </DialogHeader>
          
          <div className="grid grid-cols-4 gap-4 p-4">
            {AVATARS.map((avatar) => (
              <button
                key={avatar}
                disabled={isUpdatingAvatar}
                onClick={() => handleAvatarSelect(avatar)}
                className="aspect-square rounded-2xl overflow-hidden border-4 border-transparent hover:border-blue-400 hover:shadow-md transition-all active:scale-95 disabled:opacity-50"
              >
                <img src={avatar} alt="avatar option" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>

          <div className="flex justify-center mt-2">
            <Button 
              variant="ghost" 
              className="rounded-full text-zinc-500"
              onClick={() => setEditingAvatarUser(null)}
              disabled={isUpdatingAvatar}
            >
              キャンセル
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

