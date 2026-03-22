'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getBrowserSupabaseClient } from '@/lib/auth/browser';
import { AUTH_MODE, DEV_SHORTCUT_ENABLED } from '@/lib/auth/constants';
import QuizlyLogo from '@/components/QuizlyLogo';
import { ArrowRight, KeyRound, Mail, Play, PlusCircle, ShieldCheck, UserPlus } from 'lucide-react';

type ChildProfile = {
  id: string;
  display_name: string;
  total_points: number;
  avatar_url: string | null;
};

const SESSION_BOOTSTRAP_TIMEOUT_MS = 10000;

async function withTimeoutOrNull<T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> {
  return new Promise<T | null>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      resolve(null);
    }, timeoutMs);

    promise
      .then((result) => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch((error: unknown) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

export default function HomeClient() {
  const router = useRouter();
  const supabase = getBrowserSupabaseClient();

  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isLoadingChildren, setIsLoadingChildren] = useState(false);
  const [hasResolvedChildren, setHasResolvedChildren] = useState(false);
  const [isAutoSelectingChild, setIsAutoSelectingChild] = useState(false);
  const [isParentAuthenticated, setIsParentAuthenticated] = useState(false);
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [isSendingMagicLink, setIsSendingMagicLink] = useState(false);
  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const [newChildName, setNewChildName] = useState('');

  const hasChildren = children.length > 0;
  const selectedChild = useMemo(
    () => children.find((child) => child.id === selectedChildId) ?? null,
    [children, selectedChildId],
  );

  const ensureGuardianProfile = async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const fallbackName = userData.user.user_metadata?.name ?? userData.user.email?.split('@')[0] ?? '保護者';
    await supabase.from('guardian_accounts').upsert(
      {
        id: userData.user.id,
        email: userData.user.email ?? null,
        display_name: String(fallbackName),
      },
      { onConflict: 'id' },
    );
  };

  const getAccessToken = async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  };

  const selectChild = async (childId: string) => {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      setMessage('保護者ログインが必要です。');
      return;
    }

    const response = await fetch('/api/session/child/select', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ childId }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setMessage(body?.error ?? '子プロフィールの選択に失敗しました。');
      return;
    }

    setMessage('');
    router.push('/dashboard');
  };

  const loadChildren = async () => {
    setIsLoadingChildren(true);
    try {
      const { data, error } = await supabase
        .from('child_profiles')
        .select('id, display_name, total_points, avatar_url')
        .order('created_at', { ascending: true });

      if (error) {
        setMessage(`子プロフィールの取得に失敗しました: ${error.message}`);
        return;
      }

      const list = (data ?? []) as ChildProfile[];
      setChildren(list);
      if (!selectedChildId && list[0]) setSelectedChildId(list[0].id);

      // 子が1人なら即開始（子側PINなし）
      if (list.length === 1) {
        setIsAutoSelectingChild(true);
        void selectChild(list[0].id);
      } else {
        setIsAutoSelectingChild(false);
      }
    } finally {
      setHasResolvedChildren(true);
      setIsLoadingChildren(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const syncSessionState = async (session: any) => {
      try {
        if (!session) {
          setIsParentAuthenticated(false);
          setChildren([]);
          setSelectedChildId('');
          setHasResolvedChildren(true);
          setIsAutoSelectingChild(false);
          return;
        }

        setIsParentAuthenticated(true);

        const ensureResult = await withTimeoutOrNull(ensureGuardianProfile(), SESSION_BOOTSTRAP_TIMEOUT_MS);
        if (!isMounted) return;
        if (ensureResult === null) {
          setHasResolvedChildren(true);
          setMessage('ログイン情報の確認に時間がかかっています。ページを再読み込みしてください。');
          return;
        }

        const loadChildrenResult = await withTimeoutOrNull(loadChildren(), SESSION_BOOTSTRAP_TIMEOUT_MS);
        if (!isMounted) return;
        if (loadChildrenResult === null) {
          setHasResolvedChildren(true);
          setMessage('子プロフィールの読み込みに時間がかかっています。ページを再読み込みしてください。');
          return;
        }
      } catch (error) {
        console.error('session sync failed:', error);
        if (!isMounted) return;
        setHasResolvedChildren(true);
        setMessage('初期化に失敗しました。ページを再読み込みしてください。');
      }
    };

    const bootstrap = async () => {
      try {
        const sessionResult = await withTimeoutOrNull<any>(supabase.auth.getSession(), SESSION_BOOTSTRAP_TIMEOUT_MS);
        if (!isMounted) return;

        if (!sessionResult) {
          setIsParentAuthenticated(false);
          setHasResolvedChildren(true);
          setMessage('ログイン状態の確認に時間がかかっています。ページを再読み込みしてください。');
          return;
        }

        await syncSessionState(sessionResult.data.session);
      } catch (error) {
        console.error('bootstrap failed:', error);
        if (!isMounted) return;
        setHasResolvedChildren(true);
        setMessage('初期化に失敗しました。ページを再読み込みしてください。');
      } finally {
        if (!isMounted) return;
        setIsBootstrapping(false);
      }
    };
    void bootstrap();

    const { data: sub } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      if (!isMounted) return;
      window.setTimeout(() => {
        if (!isMounted) return;
        setHasResolvedChildren(false);
        void syncSessionState(session);
      }, 0);
    });

    return () => {
      isMounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

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

    const accessToken = await getAccessToken();
    if (!accessToken) {
      setMessage('保護者ログインが必要です。');
      return;
    }

    const response = await fetch('/api/children/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ displayName: newChildName }),
    });

    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) {
      setMessage(body?.error ?? '子プロフィール作成に失敗しました。');
      return;
    }

    setNewChildName('');
    await loadChildren();
  };

  const handleChildSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedChild) {
      setMessage('子どもを選択してください。');
      return;
    }
    await selectChild(selectedChild.id);
  };

  if (isBootstrapping) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-4 rounded-[2rem] border-4 border-zinc-400 bg-white p-8 text-center shadow-brutal">
        <QuizlyLogo variant="horizontal" theme="light" className="h-auto w-full max-w-[240px] sm:max-w-[300px]" />
        <p className="text-lg font-black text-zinc-700">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="mx-auto w-full max-w-xl space-y-4 text-center">
        <QuizlyLogo variant="horizontal" theme="light" className="mx-auto h-auto w-full max-w-[300px] sm:max-w-[390px] md:max-w-[460px]" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-[2rem] border-4 border-zinc-400 bg-white p-5 shadow-brutal sm:p-6">
          <h2 className="mb-4 inline-flex items-center gap-2 text-lg font-black text-zinc-800 sm:text-xl">
            <ShieldCheck className="h-5 w-5 text-teal-700" />
            保護者ログイン
          </h2>

          {!isParentAuthenticated ? (
            <>
              <div className="grid gap-3">
                <button onClick={handleGoogleSignIn} className="min-h-11 rounded-xl border-2 border-zinc-300 bg-zinc-100 px-4 py-3 font-bold hover:bg-zinc-200">
                  Google でログイン
                </button>
                <button onClick={handlePasskeySignIn} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border-2 border-zinc-300 bg-zinc-100 px-4 py-3 font-bold hover:bg-zinc-200">
                  <KeyRound className="h-4 w-4" />
                  Passkey でログイン
                </button>
                {DEV_SHORTCUT_ENABLED && AUTH_MODE === 'development' && (
                  <button
                    onClick={handleDevShortcut}
                    className="min-h-11 rounded-xl border-2 border-amber-300 bg-amber-100 px-4 py-3 font-bold text-amber-800 hover:bg-amber-200"
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
                  className="min-h-11 rounded-xl border-2 border-zinc-300 bg-white px-3"
                  placeholder="parent@example.com"
                />
                <button
                  type="submit"
                  disabled={isSendingMagicLink}
                  className="min-h-11 rounded-xl border-2 border-teal-400 bg-teal-100 px-4 py-2 font-bold text-teal-800 hover:bg-teal-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSendingMagicLink ? '送信中...' : 'Magic Link を送信'}
                </button>
              </form>
            </>
          ) : (
            <div className="rounded-2xl border-2 border-teal-300 bg-teal-50 p-3 text-sm font-bold text-teal-700">
              保護者ログイン済みです。右側で子どもを選択または追加してください。
            </div>
          )}
        </section>

        <section className="rounded-[2rem] border-4 border-zinc-400 bg-white p-5 shadow-brutal sm:p-6">
          <h2 className="mb-4 inline-flex items-center gap-2 text-lg font-black text-zinc-800 sm:text-xl">
            <Play className="h-5 w-5 text-teal-700" />
            子ども選択と学習開始
          </h2>

          {!isParentAuthenticated && (
            <div className="rounded-2xl border-2 border-zinc-300 bg-zinc-50 p-3 text-sm font-bold text-zinc-700">
              まず左側で保護者ログインしてください。ログイン後に子どもを選択して学習を開始できます。
            </div>
          )}

          {isLoadingChildren && <p className="text-sm font-bold text-zinc-600">子プロフィールを読み込み中...</p>}
          {isAutoSelectingChild && !isLoadingChildren && (
            <p className="text-sm font-bold text-zinc-600">学習画面へ移動しています...</p>
          )}

          {isParentAuthenticated && hasResolvedChildren && !isLoadingChildren && children.length === 0 && (
            <form className="grid gap-3" onSubmit={handleCreateChild}>
              <label className="inline-flex items-center gap-2 text-sm font-black text-zinc-700">
                <UserPlus className="h-4 w-4" />
                子どもの表示名
              </label>
              <input
                required
                value={newChildName}
                onChange={(e) => setNewChildName(e.target.value)}
                className="min-h-11 rounded-xl border-2 border-zinc-300 px-3"
                placeholder="たろう"
              />
              <button type="submit" className="min-h-11 rounded-xl border-2 border-teal-400 bg-teal-100 px-4 py-2 font-bold text-teal-800 hover:bg-teal-200">
                子プロフィールを作成
              </button>
            </form>
          )}

          {isParentAuthenticated && hasResolvedChildren && !isLoadingChildren && !isAutoSelectingChild && children.length > 0 && (
            <>
              <form className="grid gap-3" onSubmit={handleChildSubmit}>
                <label className="text-sm font-bold text-zinc-700">学習する子ども</label>
                <select value={selectedChildId} onChange={(e) => setSelectedChildId(e.target.value)} className="min-h-11 rounded-xl border-2 border-zinc-300 px-3">
                  {children.map((child) => (
                    <option key={child.id} value={child.id}>
                      {child.display_name}
                    </option>
                  ))}
                </select>
                <button type="submit" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border-2 border-teal-400 bg-teal-100 px-4 py-2 font-bold text-teal-800 hover:bg-teal-200">
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
                  className="min-h-11 rounded-xl border-2 border-zinc-300 px-3"
                  placeholder="はなこ"
                />
                <button type="submit" className="min-h-11 rounded-xl border-2 border-zinc-300 bg-zinc-100 px-4 py-2 font-bold text-zinc-700 hover:bg-zinc-200">
                  追加する
                </button>
              </form>
            </>
          )}
        </section>
      </div>

      {isParentAuthenticated && hasResolvedChildren && !isLoadingChildren && !hasChildren && (
        <p className="rounded-2xl border-2 border-teal-300 bg-teal-50 p-3 text-sm font-bold text-teal-700">
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
