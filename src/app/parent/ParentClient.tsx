'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getBrowserSupabaseClient } from '@/lib/auth/browser';

type VerifyResponse = {
  verified: boolean;
  expiresAt: string | null;
};

export default function ParentClient() {
  const router = useRouter();
  const supabase = getBrowserSupabaseClient();

  const [loading, setLoading] = useState(true);
  const [unlocked, setUnlocked] = useState(false);
  const [hasParentPin, setHasParentPin] = useState(false);
  const [pin, setPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [newPinConfirm, setNewPinConfirm] = useState('');
  const [message, setMessage] = useState('');

  const getToken = async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  };

  const loadState = async () => {
    const accessToken = await getToken();
    if (!accessToken) {
      router.replace('/');
      return;
    }

    const [verifyRes, pinStatusRes] = await Promise.all([
      fetch('/api/auth/parent/reauth/verify', { headers: { Authorization: `Bearer ${accessToken}` } }),
      fetch('/api/auth/parent/pin/status', { headers: { Authorization: `Bearer ${accessToken}` } }),
    ]);

    const verifyBody = (await verifyRes.json().catch(() => null)) as VerifyResponse | null;
    const pinStatusBody = (await pinStatusRes.json().catch(() => null)) as { hasParentPin?: boolean } | null;

    setUnlocked(Boolean(verifyBody?.verified));
    setHasParentPin(Boolean(pinStatusBody?.hasParentPin));
    setLoading(false);
  };

  useEffect(() => {
    void loadState();
  }, []);

  const handleSetPin = async (event: FormEvent) => {
    event.preventDefault();
    setMessage('');

    if (!/^\d{4}$/.test(newPin)) {
      setMessage('4桁の数字PINを入力してください。');
      return;
    }
    if (newPin !== newPinConfirm) {
      setMessage('PIN確認が一致しません。');
      return;
    }

    const accessToken = await getToken();
    if (!accessToken) {
      router.replace('/');
      return;
    }

    const response = await fetch('/api/auth/parent/pin/set', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ pin: newPin }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setMessage(body?.error ?? 'PIN設定に失敗しました。');
      return;
    }

    setHasParentPin(true);
    setNewPin('');
    setNewPinConfirm('');
    setMessage('親PINを設定しました。続けて解除してください。');
  };

  const handleUnlock = async (event: FormEvent) => {
    event.preventDefault();
    setMessage('');

    if (!/^\d{4}$/.test(pin)) {
      setMessage('4桁の数字PINを入力してください。');
      return;
    }

    const accessToken = await getToken();
    if (!accessToken) {
      router.replace('/');
      return;
    }

    const response = await fetch('/api/auth/parent/reauth/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ pin }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setMessage(body?.error ?? '親ロックの解除に失敗しました。');
      return;
    }

    setPin('');
    setUnlocked(true);
  };

  if (loading) {
    return <p className="text-center text-lg font-bold text-zinc-700">読み込み中...</p>;
  }

  if (!hasParentPin) {
    return (
      <div className="mx-auto w-full max-w-lg rounded-3xl border-4 border-zinc-400 bg-white p-6 shadow-brutal">
        <h1 className="text-2xl font-black text-zinc-900">保護者PINの初期設定</h1>
        <p className="mt-2 text-sm font-bold text-zinc-600">設定・履歴・問題管理に入るときに使う4桁PINです。</p>
        <form className="mt-4 grid gap-3" onSubmit={handleSetPin}>
          <input
            value={newPin}
            onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            className="min-h-11 rounded-xl border-2 border-zinc-300 px-3"
            inputMode="numeric"
            maxLength={4}
            placeholder="新しいPIN"
          />
          <input
            value={newPinConfirm}
            onChange={(e) => setNewPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 4))}
            className="min-h-11 rounded-xl border-2 border-zinc-300 px-3"
            inputMode="numeric"
            maxLength={4}
            placeholder="確認用PIN"
          />
          <button type="submit" className="min-h-11 rounded-xl border-2 border-teal-400 bg-teal-100 px-4 py-2 font-black text-teal-800 hover:bg-teal-200">
            PINを設定
          </button>
        </form>
        {message && <p className="mt-3 rounded-xl border-2 border-zinc-300 bg-zinc-50 p-3 text-sm font-bold text-zinc-700">{message}</p>}
      </div>
    );
  }

  if (!unlocked) {
    return (
      <div className="mx-auto w-full max-w-lg rounded-3xl border-4 border-zinc-400 bg-white p-6 shadow-brutal">
        <h1 className="text-2xl font-black text-zinc-900">保護者管理を開く</h1>
        <p className="mt-2 text-sm font-bold text-zinc-600">続行するには親PINを入力してください。</p>
        <form className="mt-4 grid gap-3" onSubmit={handleUnlock}>
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            className="min-h-11 rounded-xl border-2 border-zinc-300 px-3"
            inputMode="numeric"
            maxLength={4}
            placeholder="4桁PIN"
          />
          <button type="submit" className="min-h-11 rounded-xl border-2 border-teal-400 bg-teal-100 px-4 py-2 font-black text-teal-800 hover:bg-teal-200">
            解除する
          </button>
        </form>
        {message && <p className="mt-3 rounded-xl border-2 border-zinc-300 bg-zinc-50 p-3 text-sm font-bold text-zinc-700">{message}</p>}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl rounded-3xl border-4 border-zinc-400 bg-white p-6 shadow-brutal">
      <h1 className="text-2xl font-black text-zinc-900">保護者管理モード</h1>
      <p className="mt-2 text-sm font-bold text-zinc-600">ここから設定・履歴・問題管理に進めます（親ロック解除済み）。</p>
      <div className="mt-4 flex gap-2">
        <button
          onClick={() => router.push('/dashboard')}
          className="min-h-11 rounded-xl border-2 border-zinc-300 bg-zinc-100 px-4 py-2 font-black text-zinc-700 hover:bg-zinc-200"
        >
          ダッシュボードへ戻る
        </button>
      </div>
    </div>
  );
}
