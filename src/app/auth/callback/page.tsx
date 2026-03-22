'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getBrowserSupabaseClient } from '@/lib/auth/browser';
import { preloadDashboardSnapshot } from '@/lib/auth/dashboardPreload';

type ActiveChild = {
  id: string;
};

type ChildProfile = {
  id: string;
};

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const run = async () => {
      const supabase = getBrowserSupabaseClient();
      const code = new URL(window.location.href).searchParams.get('code');

      if (code) {
        await supabase.auth.exchangeCodeForSession(code);
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      const user = sessionData.session?.user;

      if (!accessToken || !user) {
        router.replace('/');
        return;
      }

      const fallbackName = user.user_metadata?.name ?? user.email?.split('@')[0] ?? '保護者';
      await supabase.from('guardian_accounts').upsert(
        {
          id: user.id,
          email: user.email ?? null,
          display_name: String(fallbackName),
        },
        { onConflict: 'id' },
      );

      const currentChildResponse = await fetch('/api/session/child/current', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const currentChildBody = (await currentChildResponse.json().catch(() => null)) as { child?: ActiveChild | null } | null;
      if (currentChildBody?.child) {
        await preloadDashboardSnapshot({ accessToken, supabase, childId: currentChildBody.child.id });
        router.replace('/dashboard');
        return;
      }

      const { data: children, error: childrenError } = await supabase
        .from('child_profiles')
        .select('id')
        .order('created_at', { ascending: true });

      if (childrenError) {
        router.replace('/');
        return;
      }

      const childList = (children ?? []) as ChildProfile[];
      if (childList.length === 1) {
        const selectResponse = await fetch('/api/session/child/select', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ childId: childList[0].id }),
        });

        if (selectResponse.ok) {
          await preloadDashboardSnapshot({ accessToken, supabase, childId: childList[0].id });
          router.replace('/dashboard');
          return;
        }
      }

      router.replace('/');
    };

    void run();
  }, [router]);

  return <p className="p-8 text-center text-lg font-bold text-zinc-700">認証を確認しています...</p>;
}
