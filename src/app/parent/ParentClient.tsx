'use client';

import { FormEvent, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  BarChart3,
  BookOpenCheck,
  ChevronRight,
  Clock3,
  KeyRound,
  LineChart,
  LogOut,
  NotebookText,
  Pencil,
  PlusCircle,
  Shield,
  Trash2,
  UserRound,
} from 'lucide-react';
import { getBrowserSupabaseClient } from '@/lib/auth/browser';
import type { ParentManagementSnapshot, ParentSessionHistoryItem, ParentSessionSummary } from '@/lib/auth/data';

type SectionKey = 'children' | 'history' | 'analytics' | 'settings';

const sectionMeta: Array<{ key: SectionKey; label: string; icon: typeof UserRound }> = [
  { key: 'children', label: '子ども管理', icon: UserRound },
  { key: 'history', label: '学習履歴', icon: NotebookText },
  { key: 'analytics', label: '学習分析', icon: LineChart },
  { key: 'settings', label: 'アカウント設定', icon: Shield },
];

function formatDateTime(value: string | null) {
  if (!value) return '未記録';
  return new Intl.DateTimeFormat('ja-JP', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatDate(value: string | null) {
  if (!value) return '未記録';
  return new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
  }).format(new Date(value));
}

function getSessionScoreLabel(session: ParentSessionSummary) {
  return `${session.correct_count} / ${session.total_questions}問正解`;
}

function getErrorMessage(body: unknown, fallback: string) {
  if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') {
    return body.error;
  }
  return fallback;
}

export default function ParentClient({
  initialHasParentPin,
  initialUnlocked,
  initialSnapshot,
}: {
  initialHasParentPin: boolean;
  initialUnlocked: boolean;
  initialSnapshot: ParentManagementSnapshot | null;
}) {
  const router = useRouter();
  const supabase = getBrowserSupabaseClient();
  const [unlocked, setUnlocked] = useState(initialUnlocked);
  const [hasParentPin, setHasParentPin] = useState(initialHasParentPin);
  const [pin, setPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [newPinConfirm, setNewPinConfirm] = useState('');
  const [message, setMessage] = useState('');
  const [activeSection, setActiveSection] = useState<SectionKey>('children');
  const [selectedChildId, setSelectedChildId] = useState(initialSnapshot?.children[0]?.id ?? '');
  const [newChildName, setNewChildName] = useState('');
  const [editingChildId, setEditingChildId] = useState<string | null>(null);
  const [editingChildName, setEditingChildName] = useState('');
  const [accountDeleteConfirmation, setAccountDeleteConfirmation] = useState('');
  const [isMutating, startMutation] = useTransition();
  const [analyticsNow] = useState(() => Date.now());
  const [isOpeningParentMode, setIsOpeningParentMode] = useState(false);

  const effectiveSelectedChildId =
    initialSnapshot?.children.some((child) => child.id === selectedChildId)
      ? selectedChildId
      : (initialSnapshot?.children[0]?.id ?? '');

  const selectedChild = useMemo(
    () => initialSnapshot?.children.find((child) => child.id === effectiveSelectedChildId) ?? null,
    [effectiveSelectedChildId, initialSnapshot],
  );

  const sessionsByChild = useMemo(() => {
    const grouped = new Map<string, ParentSessionSummary[]>();

    for (const session of initialSnapshot?.sessions ?? []) {
      const current = grouped.get(session.child_id) ?? [];
      current.push(session);
      grouped.set(session.child_id, current);
    }

    return grouped;
  }, [initialSnapshot]);

  const historyBySessionId = useMemo(() => {
    const grouped = new Map<string, ParentSessionHistoryItem[]>();

    for (const item of initialSnapshot?.historyItems ?? []) {
      const current = grouped.get(item.session_id) ?? [];
      current.push(item);
      grouped.set(item.session_id, current);
    }

    for (const [sessionId, items] of grouped) {
      grouped.set(
        sessionId,
        [...items].sort((left, right) => new Date(left.answered_at).getTime() - new Date(right.answered_at).getTime()),
      );
    }

    return grouped;
  }, [initialSnapshot]);

  const childSummaryById = useMemo(() => {
    const now = analyticsNow;
    const last7DaysBoundary = now - 7 * 24 * 60 * 60 * 1000;
    const summaryMap = new Map<
      string,
      {
        last7DaysCount: number;
      }
    >();

    for (const child of initialSnapshot?.children ?? []) {
      const sessions = sessionsByChild.get(child.id) ?? [];
      const last7DaysCount = sessions.filter((session) => new Date(session.completed_at ?? session.started_at).getTime() >= last7DaysBoundary).length;

      summaryMap.set(child.id, {
        last7DaysCount,
      });
    }

    return summaryMap;
  }, [analyticsNow, initialSnapshot, sessionsByChild]);

  const selectedChildAnalytics = useMemo(() => {
    if (!selectedChild || !initialSnapshot) return null;

    const sessions = sessionsByChild.get(selectedChild.id) ?? [];
    const parentGenreNameById = new Map(initialSnapshot.parentGenres.map((genre) => [genre.id, genre.name] as const));
    const now = analyticsNow;
    const last7DaysBoundary = now - 7 * 24 * 60 * 60 * 1000;
    const last30DaysBoundary = now - 30 * 24 * 60 * 60 * 1000;
    const attemptedGenreIds = new Set(sessions.map((session) => session.genre_id).filter((genreId): genreId is string => Boolean(genreId)));
    const genreBreakdown = new Map<string, { parentName: string | null; name: string; correct: number; total: number; attempts: number }>();
    const recentActivity: Array<{ label: string; count: number }> = [];

    for (let offset = 6; offset >= 0; offset -= 1) {
      const date = new Date(now - offset * 24 * 60 * 60 * 1000);
      const key = date.toISOString().slice(0, 10);
      const count = sessions.filter((session) => (session.completed_at ?? session.started_at).slice(0, 10) === key).length;
      recentActivity.push({
        label: `${date.getMonth() + 1}/${date.getDate()}`,
        count,
      });
    }

    for (const session of sessions) {
      if (!session.genre_id || !session.genre_name) continue;

      const current = genreBreakdown.get(session.genre_id) ?? {
        parentName: session.parent_genre_id ? parentGenreNameById.get(session.parent_genre_id) ?? null : null,
        name: session.genre_name,
        correct: 0,
        total: 0,
        attempts: 0,
      };

      current.correct += session.correct_count;
      current.total += session.total_questions;
      current.attempts += 1;
      genreBreakdown.set(session.genre_id, current);
    }

    const weakGenres = [...genreBreakdown.entries()]
      .map(([genreId, stats]) => ({
        genreId,
        parentName: stats.parentName,
        name: stats.name,
        attempts: stats.attempts,
        accuracy: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
      }))
      .sort((left, right) => left.accuracy - right.accuracy || right.attempts - left.attempts)
      .slice(0, 3);

    const unlearnedGenres = initialSnapshot.leafGenres
      .filter((genre) => !attemptedGenreIds.has(genre.id))
      .map((genre) => ({
        ...genre,
        parentName: genre.parent_id ? parentGenreNameById.get(genre.parent_id) ?? null : null,
      }));

    return {
      sessions,
      last7DaysCount: sessions.filter((session) => new Date(session.completed_at ?? session.started_at).getTime() >= last7DaysBoundary).length,
      last30DaysCount: sessions.filter((session) => new Date(session.completed_at ?? session.started_at).getTime() >= last30DaysBoundary).length,
      weakGenres,
      unlearnedGenres,
      recentActivity,
      genreBreakdown: [...genreBreakdown.entries()]
        .map(([genreId, stats]) => ({
          genreId,
          parentName: stats.parentName,
          name: stats.name,
          attempts: stats.attempts,
          accuracy: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
        }))
        .sort((left, right) => right.attempts - left.attempts || right.accuracy - left.accuracy),
    };
  }, [analyticsNow, initialSnapshot, selectedChild, sessionsByChild]);

  const selectedChildSessions = useMemo(
    () => (selectedChild ? sessionsByChild.get(selectedChild.id) ?? [] : []),
    [selectedChild, sessionsByChild],
  );

  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);

  const refreshParentPage = () => {
    startMutation(() => {
      router.refresh();
    });
  };

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

    const response = await fetch('/api/auth/parent/pin/set', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pin: newPin }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setMessage(getErrorMessage(body, 'PIN設定に失敗しました。'));
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

    const response = await fetch('/api/auth/parent/reauth/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pin }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setMessage(getErrorMessage(body, '親ロックの解除に失敗しました。'));
      return;
    }

    setPin('');
    setIsOpeningParentMode(true);
    setUnlocked(true);
    refreshParentPage();
  };

  const handleCreateChild = async (event: FormEvent) => {
    event.preventDefault();
    setMessage('');

    if (!newChildName.trim()) {
      setMessage('子どもの表示名を入力してください。');
      return;
    }

    const response = await fetch('/api/children/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ displayName: newChildName.trim() }),
    });
    const body = await response.json().catch(() => null);

    if (!response.ok) {
      setMessage(getErrorMessage(body, '子プロフィールの追加に失敗しました。'));
      return;
    }

    setNewChildName('');
    setMessage('子プロフィールを追加しました。');
    refreshParentPage();
  };

  const startEditingChild = (childId: string, displayName: string) => {
    setEditingChildId(childId);
    setEditingChildName(displayName);
    setMessage('');
  };

  const handleRenameChild = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingChildId) return;

    const nextName = editingChildName.trim();
    if (!nextName) {
      setMessage('表示名を入力してください。');
      return;
    }

    const response = await fetch(`/api/children/${editingChildId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ displayName: nextName }),
    });
    const body = await response.json().catch(() => null);

    if (!response.ok) {
      setMessage(getErrorMessage(body, '子プロフィールの更新に失敗しました。'));
      return;
    }

    setEditingChildId(null);
    setEditingChildName('');
    setMessage('子どもの表示名を更新しました。');
    refreshParentPage();
  };

  const handleDeleteChild = async (childId: string, displayName: string) => {
    setMessage('');
    if (!window.confirm(`「${displayName}」を削除します。学習履歴とポイント履歴も消えます。続けますか？`)) {
      return;
    }

    const response = await fetch(`/api/children/${childId}`, {
      method: 'DELETE',
    });
    const body = await response.json().catch(() => null);

    if (!response.ok) {
      setMessage(getErrorMessage(body, '子プロフィールの削除に失敗しました。'));
      return;
    }

    if (editingChildId === childId) {
      setEditingChildId(null);
      setEditingChildName('');
    }

    setExpandedSessionId(null);
    setMessage('子プロフィールを削除しました。');
    refreshParentPage();
  };

  const handleChangePin = async (event: FormEvent) => {
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

    const response = await fetch('/api/auth/parent/pin/set', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pin: newPin }),
    });
    const body = await response.json().catch(() => null);

    if (!response.ok) {
      setMessage(getErrorMessage(body, 'PIN変更に失敗しました。'));
      return;
    }

    setNewPin('');
    setNewPinConfirm('');
    setMessage('親PINを更新しました。');
  };

  const handleDeleteAccount = async () => {
    setMessage('');

    if (accountDeleteConfirmation !== 'DELETE') {
      setMessage('退会するには確認欄に DELETE と入力してください。');
      return;
    }

    if (!window.confirm('世帯内の子プロフィール、学習履歴、ポイント履歴を削除してログアウトします。続けますか？')) {
      return;
    }

    const response = await fetch('/api/parent/account', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ confirmation: accountDeleteConfirmation }),
    });
    const body = await response.json().catch(() => null);

    if (!response.ok) {
      setMessage(getErrorMessage(body, '退会処理に失敗しました。'));
      return;
    }

    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  if (!hasParentPin) {
    return (
      <div className="mx-auto w-full max-w-lg rounded-3xl border-4 border-zinc-400 bg-white p-6 shadow-brutal">
        <h1 className="text-2xl font-black text-zinc-900">保護者PINの初期設定</h1>
        <p className="mt-2 text-sm font-bold text-zinc-600">設定や学習履歴を見るときに使う4桁PINです。</p>
        <form className="mt-4 grid gap-3" onSubmit={handleSetPin}>
          <input
            value={newPin}
            onChange={(event) => setNewPin(event.target.value.replace(/\D/g, '').slice(0, 4))}
            className="min-h-11 rounded-xl border-2 border-zinc-300 px-3"
            inputMode="numeric"
            maxLength={4}
            placeholder="新しいPIN"
          />
          <input
            value={newPinConfirm}
            onChange={(event) => setNewPinConfirm(event.target.value.replace(/\D/g, '').slice(0, 4))}
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
            onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 4))}
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

  if (!initialSnapshot) {
    return (
      <div className="mx-auto w-full max-w-2xl rounded-3xl border-4 border-zinc-400 bg-white p-6 shadow-brutal">
        <h1 className="text-2xl font-black text-zinc-900">保護者管理モード</h1>
        <p className="mt-2 text-sm font-bold text-zinc-600">
          {isOpeningParentMode ? '管理データを読み込んでいます。' : '管理データの読み込みに失敗しました。時間をおいて再度お試しください。'}
        </p>
        <div className="mt-4 flex gap-2">
          {isOpeningParentMode ? (
            <div className="inline-flex min-h-11 items-center rounded-xl border-2 border-teal-300 bg-teal-50 px-4 py-2 text-sm font-black text-teal-800">
              読み込み中...
            </div>
          ) : (
            <button
              onClick={() => router.refresh()}
              className="min-h-11 rounded-xl border-2 border-teal-400 bg-teal-100 px-4 py-2 font-black text-teal-800 hover:bg-teal-200"
            >
              再読み込み
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-1 sm:gap-8 sm:p-2">
      <header className="rounded-[2rem] border-4 border-zinc-400 bg-white p-5 shadow-brutal sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border-2 border-slate-300 bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
              <Shield className="h-4 w-4" />
              保護者管理モード
            </div>
            <h1 className="mt-3 text-[clamp(1.8rem,5vw,2.7rem)] font-black text-zinc-900">家庭の学習状況をまとめて確認</h1>
            <p className="mt-2 max-w-3xl text-sm font-bold leading-relaxed text-zinc-600 sm:text-base">
              子どもの管理、学習履歴、ジャンル別の傾向、アカウント設定をここでまとめて扱えます。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => router.push('/dashboard')}
              className="min-h-11 rounded-xl border-2 border-zinc-300 bg-zinc-100 px-4 py-2 text-sm font-black text-zinc-700 hover:bg-zinc-200"
            >
              ダッシュボードへ戻る
            </button>
            <button
              onClick={async () => {
                await fetch('/api/session/child/logout', { method: 'POST' });
                await supabase.auth.signOut();
                router.push('/');
              }}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border-2 border-amber-300 bg-amber-100 px-4 py-2 text-sm font-black text-amber-800 hover:bg-amber-200"
            >
              <LogOut className="h-4 w-4" />
              ログアウト
            </button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {sectionMeta.map((section) => {
            const Icon = section.icon;
            const isActive = activeSection === section.key;

            return (
              <button
                key={section.key}
                onClick={() => setActiveSection(section.key)}
                className={`inline-flex min-h-11 items-center gap-2 rounded-full border-4 px-4 py-2 text-sm font-black shadow-brutal-sm transition-colors ${
                  isActive
                    ? 'border-teal-400 bg-teal-100 text-teal-900'
                    : 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50'
                }`}
              >
                <Icon className="h-4 w-4" />
                {section.label}
              </button>
            );
          })}
        </div>
      </header>

      {message && (
        <p className="rounded-2xl border-2 border-zinc-300 bg-zinc-50 p-3 text-sm font-bold text-zinc-700">
          {message}
        </p>
      )}

      {activeSection === 'children' && (
        <section className="rounded-[2rem] border-4 border-zinc-400 bg-white p-5 shadow-brutal sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-black text-zinc-900">子ども管理</h2>
              <p className="mt-1 text-sm font-bold text-zinc-600">プロフィールの追加、表示名変更、削除ができます。</p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border-2 border-zinc-300 bg-zinc-100 px-3 py-1 text-sm font-black text-zinc-700">
              <UserRound className="h-4 w-4" />
              {initialSnapshot.children.length}人登録中
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {initialSnapshot.children.map((child) => {
              const isEditing = editingChildId === child.id;
              const childSummary = childSummaryById.get(child.id) ?? {
                last7DaysCount: 0,
              };

              return (
                <article key={child.id} className="rounded-[1.7rem] border-4 border-zinc-400 bg-white p-4 shadow-brutal-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xl font-black text-zinc-900">{child.display_name}</p>
                      <p className="mt-1 text-xs font-bold text-zinc-500">登録日: {formatDate(child.created_at)}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => startEditingChild(child.id, child.display_name)}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border-2 border-zinc-300 bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                        title="表示名を変更"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteChild(child.id, child.display_name)}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border-2 border-rose-300 bg-rose-100 text-rose-700 hover:bg-rose-200"
                        title="子どもを削除"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border-2 border-zinc-300 bg-zinc-50 p-3">
                      <p className="text-xs font-black text-zinc-500">累計ポイント</p>
                      <p className="mt-1 text-lg font-black text-zinc-900">{child.total_points.toLocaleString()}pt</p>
                    </div>
                    <div className="rounded-2xl border-2 border-zinc-300 bg-zinc-50 p-3">
                      <p className="text-xs font-black text-zinc-500">学習回数</p>
                      <p className="mt-1 text-lg font-black text-zinc-900">{child.session_count}回</p>
                    </div>
                    <div className="rounded-2xl border-2 border-zinc-300 bg-zinc-50 p-3">
                      <p className="text-xs font-black text-zinc-500">直近7日</p>
                      <p className="mt-1 text-lg font-black text-zinc-900">{childSummary.last7DaysCount}回</p>
                    </div>
                    <div className="rounded-2xl border-2 border-zinc-300 bg-zinc-50 p-3">
                      <p className="text-xs font-black text-zinc-500">最終学習日</p>
                      <p className="mt-1 text-sm font-black text-zinc-900">{formatDateTime(child.last_studied_at)}</p>
                    </div>
                  </div>

                  {isEditing && (
                    <form className="mt-4 grid gap-3 rounded-2xl border-2 border-slate-300 bg-slate-50 p-3" onSubmit={handleRenameChild}>
                      <label className="text-sm font-black text-zinc-700">表示名を変更</label>
                      <input
                        value={editingChildName}
                        onChange={(event) => setEditingChildName(event.target.value)}
                        className="min-h-11 rounded-xl border-2 border-zinc-300 bg-white px-3"
                        placeholder="新しい表示名"
                      />
                      <div className="flex flex-wrap gap-2">
                        <button type="submit" className="min-h-11 rounded-xl border-2 border-slate-400 bg-slate-200 px-4 py-2 font-black text-slate-900 hover:bg-slate-300">
                          保存する
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingChildId(null);
                            setEditingChildName('');
                          }}
                          className="min-h-11 rounded-xl border-2 border-zinc-300 bg-white px-4 py-2 font-black text-zinc-700 hover:bg-zinc-100"
                        >
                          キャンセル
                        </button>
                      </div>
                    </form>
                  )}
                </article>
              );
            })}
          </div>

          <form className="mt-6 grid gap-3 rounded-[1.4rem] border-2 border-zinc-300 bg-zinc-50 p-4 sm:grid-cols-[1fr_auto]" onSubmit={handleCreateChild}>
            <div>
              <label className="mb-2 block text-sm font-black text-zinc-700">子どもを追加</label>
              <input
                value={newChildName}
                onChange={(event) => setNewChildName(event.target.value)}
                disabled={isMutating}
                className="min-h-11 w-full rounded-xl border-2 border-zinc-300 bg-white px-3"
                placeholder="例: たろう"
              />
            </div>
            <button
              type="submit"
              disabled={isMutating}
              className="inline-flex min-h-11 items-center justify-center gap-2 self-end rounded-xl border-2 border-zinc-300 bg-white px-4 py-2 font-black text-zinc-700 hover:bg-zinc-100 disabled:opacity-60"
            >
              <PlusCircle className="h-4 w-4" />
              追加する
            </button>
          </form>
        </section>
      )}

      {activeSection === 'history' && (
        <section className="rounded-[2rem] border-4 border-zinc-400 bg-white p-5 shadow-brutal sm:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-2xl font-black text-zinc-900">学習履歴</h2>
              <p className="mt-1 text-sm font-bold text-zinc-600">受講日時、ジャンル、正答数、問題ごとの回答内容を確認できます。</p>
            </div>
            <div className="w-full max-w-xs">
              <label className="mb-2 block text-sm font-black text-zinc-700">表示する子ども</label>
              <select
                value={effectiveSelectedChildId}
                onChange={(event) => {
                  setSelectedChildId(event.target.value);
                  setExpandedSessionId(null);
                }}
                className="min-h-11 w-full rounded-xl border-2 border-zinc-300 bg-white px-3"
              >
                {initialSnapshot.children.map((child) => (
                  <option key={child.id} value={child.id}>
                    {child.display_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedChildSessions.length === 0 ? (
            <div className="mt-5 rounded-[1.6rem] border-4 border-dashed border-zinc-300 bg-zinc-50 p-6 text-sm font-bold text-zinc-600">
              まだ受講履歴はありません。
            </div>
          ) : (
            <div className="mt-5 flex flex-col gap-4">
              {selectedChildSessions.map((session) => {
                const isExpanded = expandedSessionId === session.id;
                const historyItems = historyBySessionId.get(session.id) ?? [];

                return (
                  <article key={session.id} className="rounded-[1.6rem] border-4 border-zinc-400 bg-white p-4 shadow-brutal-sm">
                    <button
                      type="button"
                      onClick={() => setExpandedSessionId((current) => (current === session.id ? null : session.id))}
                      className="flex w-full items-start justify-between gap-4 text-left"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {session.genre_name && (
                            <span className="rounded-full border-2 border-teal-300 bg-teal-50 px-3 py-1 text-xs font-black text-teal-800">
                              {session.genre_name}
                            </span>
                          )}
                        </div>
                        <p className="mt-3 text-lg font-black text-zinc-900">{getSessionScoreLabel(session)}</p>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm font-bold text-zinc-600">
                          <span className="inline-flex items-center gap-1">
                            <Clock3 className="h-4 w-4" />
                            {formatDateTime(session.completed_at ?? session.started_at)}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <BarChart3 className="h-4 w-4" />
                            {session.earned_points}pt
                          </span>
                        </div>
                      </div>
                      <span className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-4 border-zinc-400 bg-white text-zinc-700 shadow-brutal-sm transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                        <ChevronRight className="h-5 w-5" />
                      </span>
                    </button>

                    {isExpanded && (
                      <div className="mt-4 border-t-4 border-zinc-200 pt-4">
                        {historyItems.length === 0 ? (
                          <p className="text-sm font-bold text-zinc-600">問題ごとの履歴はまだありません。</p>
                        ) : (
                          <div className="flex flex-col gap-3">
                            {historyItems.map((item, index) => (
                              <div
                                key={item.question_id}
                                className={`rounded-[1.2rem] border-2 p-4 ${
                                  item.is_correct ? 'border-teal-300 bg-teal-50' : 'border-rose-300 bg-rose-50'
                                }`}
                              >
                                <p className="text-base font-black text-zinc-900">
                                  {index + 1}. {item.question_text}
                                </p>
                                <div className="mt-3 grid gap-2 text-sm font-bold text-zinc-700">
                                  <p>回答: {item.options[item.selected_index] ?? '未選択'}</p>
                                  <p>正解: {item.options[item.correct_index] ?? '未設定'}</p>
                                  <p>判定: {item.is_correct ? '正解' : '不正解'}</p>
                                  {item.explanation && <p className="rounded-xl border border-zinc-200 bg-white/70 p-3">{item.explanation}</p>}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {activeSection === 'analytics' && (
        <section className="rounded-[2rem] border-4 border-zinc-400 bg-white p-5 shadow-brutal sm:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-2xl font-black text-zinc-900">学習分析</h2>
              <p className="mt-1 text-sm font-bold text-zinc-600">直近の学習回数、ジャンル別の正答率、未学習ジャンルを確認できます。</p>
            </div>
            <div className="w-full max-w-xs">
              <label className="mb-2 block text-sm font-black text-zinc-700">分析する子ども</label>
              <select
                value={effectiveSelectedChildId}
                onChange={(event) => setSelectedChildId(event.target.value)}
                className="min-h-11 w-full rounded-xl border-2 border-zinc-300 bg-white px-3"
              >
                {initialSnapshot.children.map((child) => (
                  <option key={child.id} value={child.id}>
                    {child.display_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {!selectedChild || !selectedChildAnalytics ? (
            <div className="mt-5 rounded-[1.6rem] border-4 border-dashed border-zinc-300 bg-zinc-50 p-6 text-sm font-bold text-zinc-600">
              表示できる分析データがありません。
            </div>
          ) : (
            <div className="mt-5 flex flex-col gap-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[1.5rem] border-4 border-zinc-400 bg-slate-50 p-4 shadow-brutal-sm">
                  <p className="text-sm font-black text-slate-700">直近7日</p>
                  <p className="mt-2 text-3xl font-black text-zinc-900">{selectedChildAnalytics.last7DaysCount}回</p>
                </div>
                <div className="rounded-[1.5rem] border-4 border-zinc-400 bg-teal-50 p-4 shadow-brutal-sm">
                  <p className="text-sm font-black text-teal-700">直近30日</p>
                  <p className="mt-2 text-3xl font-black text-zinc-900">{selectedChildAnalytics.last30DaysCount}回</p>
                </div>
              </div>

              <div className="grid gap-5 xl:grid-cols-[1.25fr_0.95fr]">
                <div className="rounded-[1.6rem] border-4 border-zinc-400 bg-white p-4 shadow-brutal-sm">
                  <h3 className="inline-flex items-center gap-2 text-lg font-black text-zinc-900">
                    <BookOpenCheck className="h-5 w-5 text-teal-700" />
                    ジャンル別の取り組み
                  </h3>
                  <div className="mt-4 flex flex-col gap-3">
                    {selectedChildAnalytics.genreBreakdown.length === 0 ? (
                      <p className="text-sm font-bold text-zinc-600">まだ学習データがありません。</p>
                    ) : (
                      selectedChildAnalytics.genreBreakdown.map((genre) => (
                        <div key={genre.genreId} className="rounded-2xl border-2 border-zinc-300 bg-zinc-50 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-black text-zinc-900">
                              {genre.parentName ? `${genre.parentName} > ${genre.name}` : genre.name}
                            </p>
                            <span className="text-sm font-black text-zinc-600">{genre.attempts}回</span>
                          </div>
                          <div className="mt-2 h-3 overflow-hidden rounded-full bg-zinc-200">
                            <div className="h-full rounded-full bg-teal-500" style={{ width: `${genre.accuracy}%` }} />
                          </div>
                          <p className="mt-2 text-sm font-bold text-zinc-600">正答率 {genre.accuracy}%</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-5">
                  <div className="rounded-[1.6rem] border-4 border-zinc-400 bg-white p-4 shadow-brutal-sm">
                    <h3 className="text-lg font-black text-zinc-900">最近の学習推移</h3>
                    <p className="mt-2 text-sm font-bold text-zinc-600">棒の高さはその日の学習回数を表します。</p>
                    <div className="mt-4 grid grid-cols-7 items-end gap-2">
                      {selectedChildAnalytics.recentActivity.map((item) => {
                        const height = item.count === 0 ? 14 : Math.max(item.count * 18, 26);
                        return (
                          <div key={item.label} className="flex flex-col items-center gap-2">
                            <div className="min-h-6 text-xs font-black text-zinc-600">{item.count}回</div>
                            <div className="flex h-32 items-end">
                              <div
                                className="w-8 rounded-t-xl border-2 border-zinc-400 bg-teal-300 shadow-brutal-sm"
                                style={{ height }}
                                aria-label={`${item.label}の学習回数は${item.count}回`}
                              />
                            </div>
                            <span className="text-[11px] font-black text-zinc-500">{item.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-[1.6rem] border-4 border-zinc-400 bg-white p-4 shadow-brutal-sm">
                    <h3 className="text-lg font-black text-zinc-900">最近つまずきやすいジャンル</h3>
                    <div className="mt-4 flex flex-col gap-2">
                      {selectedChildAnalytics.weakGenres.length === 0 ? (
                        <p className="text-sm font-bold text-zinc-600">十分な学習データがまだありません。</p>
                      ) : (
                        selectedChildAnalytics.weakGenres.map((genre) => (
                          <div key={genre.genreId} className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-3">
                            <p className="font-black text-zinc-900">
                              {genre.parentName ? `${genre.parentName} > ${genre.name}` : genre.name}
                            </p>
                            <p className="mt-1 text-sm font-bold text-zinc-700">正答率 {genre.accuracy}% / 受講 {genre.attempts}回</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="rounded-[1.6rem] border-4 border-zinc-400 bg-white p-4 shadow-brutal-sm">
                    <h3 className="text-lg font-black text-zinc-900">未学習ジャンル</h3>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {selectedChildAnalytics.unlearnedGenres.length === 0 ? (
                        <p className="text-sm font-bold text-zinc-600">すべての公開ジャンルに取り組んでいます。</p>
                      ) : (
                        selectedChildAnalytics.unlearnedGenres.map((genre) => (
                          <span key={genre.id} className="rounded-full border-2 border-zinc-300 bg-zinc-100 px-3 py-1 text-sm font-black text-zinc-700">
                            {genre.parentName ? `${genre.parentName} > ${genre.name}` : genre.name}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {activeSection === 'settings' && (
        <section className="grid gap-5 xl:grid-cols-[1fr_1fr]">
          <article className="rounded-[2rem] border-4 border-zinc-400 bg-white p-5 shadow-brutal sm:p-6">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl border-4 border-zinc-400 bg-slate-100 p-3 text-zinc-700 shadow-brutal-sm">
                <KeyRound className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-zinc-900">親PINの変更</h2>
                <p className="mt-1 text-sm font-bold text-zinc-600">保護者管理モードに入るときのPINを更新します。</p>
              </div>
            </div>

            <form className="mt-5 grid gap-3" onSubmit={handleChangePin}>
              <input
                value={newPin}
                onChange={(event) => setNewPin(event.target.value.replace(/\D/g, '').slice(0, 4))}
                className="min-h-11 rounded-xl border-2 border-zinc-300 px-3"
                inputMode="numeric"
                maxLength={4}
                placeholder="新しいPIN"
              />
              <input
                value={newPinConfirm}
                onChange={(event) => setNewPinConfirm(event.target.value.replace(/\D/g, '').slice(0, 4))}
                className="min-h-11 rounded-xl border-2 border-zinc-300 px-3"
                inputMode="numeric"
                maxLength={4}
                placeholder="確認用PIN"
              />
              <button type="submit" className="min-h-11 rounded-xl border-2 border-teal-400 bg-teal-100 px-4 py-2 font-black text-teal-800 hover:bg-teal-200">
                PINを更新する
              </button>
            </form>
          </article>

          <article className="rounded-[2rem] border-4 border-rose-300 bg-rose-50 p-5 shadow-brutal sm:p-6">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl border-4 border-rose-300 bg-white p-3 text-rose-700 shadow-brutal-sm">
                <Trash2 className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-zinc-900">退会</h2>
                <p className="mt-1 text-sm font-bold leading-relaxed text-zinc-700">
                  子プロフィール、学習履歴、ポイント履歴、親PIN設定を削除してログアウトします。次回ログイン時は新しい状態から始まります。
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border-2 border-rose-300 bg-white/80 p-4">
              <label className="mb-2 block text-sm font-black text-rose-800">確認のため `DELETE` と入力してください</label>
              <input
                value={accountDeleteConfirmation}
                onChange={(event) => setAccountDeleteConfirmation(event.target.value)}
                className="min-h-11 w-full rounded-xl border-2 border-rose-300 bg-white px-3"
                placeholder="DELETE"
              />
              <button
                type="button"
                onClick={() => void handleDeleteAccount()}
                className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border-2 border-rose-400 bg-rose-100 px-4 py-2 font-black text-rose-800 hover:bg-rose-200"
              >
                <Trash2 className="h-4 w-4" />
                退会する
              </button>
            </div>
          </article>
        </section>
      )}
    </div>
  );
}
