'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getBrowserSupabaseClient } from '@/lib/auth/browser';
import type { ChildProfile } from '@/lib/auth/data';
import { AUTH_MODE, DEV_SHORTCUT_ENABLED } from '@/lib/auth/constants';
import QuizlyLogo from '@/components/QuizlyLogo';
import { ArrowRight, KeyRound, Mail, Play, PlusCircle, ShieldCheck, UserPlus } from 'lucide-react';

export default function HomeClient({
  initialChildren,
  isParentAuthenticated,
}: {
  initialChildren: ChildProfile[];
  isParentAuthenticated: boolean;
}) {
  const router = useRouter();
  const supabase = getBrowserSupabaseClient();

  const [isLoadingChildren, setIsLoadingChildren] = useState(false);
  const [isAutoSelectingChild, setIsAutoSelectingChild] = useState(false);
  const [children, setChildren] = useState<ChildProfile[]>(initialChildren);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [isSendingMagicLink, setIsSendingMagicLink] = useState(false);
  const [selectedChildId, setSelectedChildId] = useState(initialChildren[0]?.id ?? '');
  const [newChildName, setNewChildName] = useState('');

  const hasChildren = children.length > 0;
  const selectedChild = useMemo(
    () => children.find((child) => child.id === selectedChildId) ?? null,
    [children, selectedChildId],
  );

  const selectChild = useCallback(async (childId: string) => {
    try {
      const response = await fetch('/api/session/child/select', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ childId }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setMessage(body?.error ?? '子プロフィールの選択に失敗しました。');
        return false;
      }

      setMessage('');
      router.replace('/dashboard');
      return true;
    } catch {
      setMessage('通信エラーが発生しました。時間をおいて再度お試しください。');
      return false;
    }
  }, [router]);

  useEffect(() => {
    if (!isParentAuthenticated || children.length !== 1 || isAutoSelectingChild) {
      return;
    }

    setIsAutoSelectingChild(true);
    void (async () => {
      const isSuccess = await selectChild(children[0].id);
      if (!isSuccess) {
        setIsAutoSelectingChild(false);
      }
    })();
  }, [children, isAutoSelectingChild, isParentAuthenticated, selectChild]);

  const handleGoogleSignIn = async () => {
    setMessage('');
    const redirectTo = `${window.location.origin}/auth/callback`;
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
    if (error) setMessage(`Googleログインに失敗しました: ${error.message}`);
  };

  const handleMagicLink = async (event: FormEvent) => {
    event.preventDefault();
    setMessage('');
    setIsSendingMagicLink(true);
    const redirectTo = `${window.location.origin}/auth/callback`;
    try {
      const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
      if (error) {
        setMessage(`Magic Link送信に失敗しました: ${error.message}`);
        return;
      }
      setMessage('Magic Link を送信しました。メールをご確認ください。');
    } finally {
      setIsSendingMagicLink(false);
    }
  };

  const handlePasskeySignIn = async () => {
    setMessage('');
    const passkeyApi = (supabase.auth as unknown as {
      signInWithWebAuthn?: () => Promise<{ error: { message: string } | null }>;
      signUpWithWebAuthn?: () => Promise<{ error: { message: string } | null }>;
    });

    if (!passkeyApi.signInWithWebAuthn && !passkeyApi.signUpWithWebAuthn) {
      setMessage('この環境の SDK では Passkey API が利用できません。Google または Magic Link を使ってください。');
      return;
    }

    const result = passkeyApi.signInWithWebAuthn
      ? await passkeyApi.signInWithWebAuthn()
      : await passkeyApi.signUpWithWebAuthn?.();

    if (result?.error) setMessage(`Passkey認証に失敗しました: ${result.error.message}`);
  };

  const handleDevShortcut = async () => {
    setMessage('');
    const authAny = supabase.auth as unknown as {
      signInAnonymously?: () => Promise<{ error: { message: string } | null }>;
    };
    if (!authAny.signInAnonymously) {
      setMessage('匿名ログインAPIが利用できません。');
      return;
    }
    const { error } = await authAny.signInAnonymously();
    if (error) setMessage(`開発ショートカットログインに失敗しました: ${error.message}`);
  };

  const handleCreateChild = async (event: FormEvent) => {
    event.preventDefault();
    setMessage('');

    if (!newChildName.trim()) {
      setMessage('子どもの表示名を入力してください。');
      return;
    }

    setIsLoadingChildren(true);
    try {
      const response = await fetch('/api/children/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ displayName: newChildName }),
      });
      const body = (await response.json().catch(() => null)) as { error?: string; child?: ChildProfile } | null;
      if (!response.ok || !body?.child) {
        setMessage(body?.error ?? '子プロフィール作成に失敗しました。');
        return;
      }

      const createdChild = body.child;
      setChildren((prev) => [...prev, createdChild]);
      setSelectedChildId((prev) => prev || createdChild.id);
      setNewChildName('');
    } catch {
      setMessage('通信エラーが発生しました。時間をおいて再度お試しください。');
    } finally {
      setIsLoadingChildren(false);
    }
  };

  const handleChildSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedChild) {
      setMessage('子どもを選択してください。');
      return;
    }
    await selectChild(selectedChild.id);
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="mx-auto w-full max-w-xl space-y-4 text-center">
        <QuizlyLogo
          variant="horizontal"
          theme="light"
          className="mx-auto h-auto w-full max-w-[300px] sm:max-w-[390px] md:max-w-[460px]"
          priority
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="subject-stripe-left rounded-[2rem] border-4 border-zinc-400 bg-white p-5 shadow-brutal sm:p-6">
          <h2 className="mb-4 inline-flex items-center gap-2 text-lg font-black text-zinc-800 sm:text-xl">
            <ShieldCheck className="h-5 w-5 text-slate-700" />
            保護者ログイン
          </h2>

          {!isParentAuthenticated ? (
            <>
              <div className="grid gap-3">
                <button onClick={handleGoogleSignIn} className="focus-ring min-h-11 rounded-xl border-2 border-zinc-300 bg-zinc-100 px-4 py-3 font-bold hover:bg-zinc-200">
                  Google でログイン
                </button>
                <button onClick={handlePasskeySignIn} className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border-2 border-zinc-300 bg-zinc-100 px-4 py-3 font-bold hover:bg-zinc-200">
                  <KeyRound className="h-4 w-4" />
                  Passkey でログイン
                </button>
                {DEV_SHORTCUT_ENABLED && AUTH_MODE === 'development' && (
                  <button
                    onClick={handleDevShortcut}
                    className="focus-ring min-h-11 rounded-xl border-2 border-amber-300 bg-amber-100 px-4 py-3 font-bold text-amber-800 hover:bg-amber-200"
                  >
                    開発ショートカットでログイン
                  </button>
                )}
              </div>

              <form className="mt-4 grid gap-2 rounded-2xl border-2 border-zinc-200 bg-zinc-50 p-3" onSubmit={handleMagicLink}>
                <label className="inline-flex items-center gap-2 text-sm font-black text-zinc-700">
                  <Mail className="h-4 w-4" />
                  Magic Link (メール)
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSendingMagicLink}
                  className="focus-ring min-h-11 rounded-xl border-2 border-zinc-300 bg-white px-3"
                  placeholder="parent@example.com"
                />
                <button
                  type="submit"
                  disabled={isSendingMagicLink}
                  className="focus-ring min-h-11 rounded-xl border-2 border-zinc-300 bg-slate-100 px-4 py-2 font-bold text-zinc-800 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSendingMagicLink ? '送信中...' : 'Magic Link を送信'}
                </button>
              </form>
            </>
          ) : (
            <div className="rounded-2xl border-2 border-zinc-300 bg-slate-50 p-3 text-sm font-bold text-slate-700">
              保護者ログイン済みです。右側で子どもを選択または追加してください。
            </div>
          )}
        </section>

        <section className="subject-stripe-left rounded-[2rem] border-4 border-zinc-400 bg-white p-5 shadow-brutal sm:p-6">
          <h2 className="mb-4 inline-flex items-center gap-2 text-lg font-black text-zinc-800 sm:text-xl">
            <Play className="h-5 w-5 text-slate-700" />
            子ども選択と学習開始
          </h2>

          {!isParentAuthenticated && (
            <div className="rounded-2xl border-2 border-zinc-300 bg-zinc-50 p-3 text-sm font-bold text-zinc-700">
              まず保護者ログインしてください。ログイン後に子どもを選択して学習を開始できます。
            </div>
          )}

          {isLoadingChildren && <p className="text-sm font-bold text-zinc-600">子プロフィールを読み込み中...</p>}
          {isAutoSelectingChild && !isLoadingChildren && (
            <p className="text-sm font-bold text-zinc-600">学習画面へ移動しています...</p>
          )}

          {isParentAuthenticated && !isLoadingChildren && children.length === 0 && (
            <form className="grid gap-3" onSubmit={handleCreateChild}>
              <label className="inline-flex items-center gap-2 text-sm font-black text-zinc-700">
                <UserPlus className="h-4 w-4" />
                子どもの表示名
              </label>
              <input
                required
                value={newChildName}
                onChange={(e) => setNewChildName(e.target.value)}
                className="focus-ring min-h-11 rounded-xl border-2 border-zinc-300 px-3"
                placeholder="たろう"
              />
              <button type="submit" className="focus-ring min-h-11 rounded-xl border-2 border-zinc-300 bg-slate-100 px-4 py-2 font-bold text-zinc-800 hover:bg-slate-200">
                子プロフィールを作成
              </button>
            </form>
          )}

          {isParentAuthenticated && !isLoadingChildren && !isAutoSelectingChild && children.length > 0 && (
            <>
              <form className="grid gap-3" onSubmit={handleChildSubmit}>
                <label className="text-sm font-bold text-zinc-700">学習する子ども</label>
                <select value={selectedChildId} onChange={(e) => setSelectedChildId(e.target.value)} className="focus-ring min-h-11 rounded-xl border-2 border-zinc-300 px-3">
                  {children.map((child) => (
                    <option key={child.id} value={child.id}>
                      {child.display_name}
                    </option>
                  ))}
                </select>
                <button type="submit" className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border-2 border-zinc-300 bg-slate-100 px-4 py-2 font-bold text-zinc-800 hover:bg-slate-200">
                  学習をはじめる
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>

              <form className="mt-4 grid gap-3 border-t-2 border-zinc-200 pt-4" onSubmit={handleCreateChild}>
                <p className="inline-flex items-center gap-2 text-sm font-black text-zinc-700">
                  <PlusCircle className="h-4 w-4" />
                  子プロフィールを追加
                </p>
                <input
                  required
                  value={newChildName}
                  onChange={(e) => setNewChildName(e.target.value)}
                  className="focus-ring min-h-11 rounded-xl border-2 border-zinc-300 px-3"
                  placeholder="はなこ"
                />
                <button type="submit" className="focus-ring min-h-11 rounded-xl border-2 border-zinc-300 bg-zinc-100 px-4 py-2 font-bold text-zinc-700 hover:bg-zinc-200">
                  追加する
                </button>
              </form>
            </>
          )}
        </section>
      </div>

      {isParentAuthenticated && !isLoadingChildren && !hasChildren && (
        <p className="rounded-2xl border-2 border-zinc-300 bg-slate-50 p-3 text-sm font-bold text-slate-700">
          子どもプロフィールはまだありません。右側の入力から作成してください。
        </p>
      )}

      {message && (
        <p className="rounded-2xl border-2 border-zinc-300 bg-zinc-50 p-3 text-sm font-bold text-zinc-700">
          {message}
        </p>
      )}
    </div>
  );
}
