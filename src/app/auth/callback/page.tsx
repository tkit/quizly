'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getBrowserSupabaseClient } from '@/lib/auth/browser';

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const run = async () => {
      const supabase = getBrowserSupabaseClient();
      const code = new URL(window.location.href).searchParams.get('code');

      if (code) {
        await supabase.auth.exchangeCodeForSession(code);
      }

      router.replace('/');
    };

    void run();
  }, [router]);

  return <p className="p-8 text-center text-lg font-bold text-zinc-700">認証を確認しています...</p>;
}
