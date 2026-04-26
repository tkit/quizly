import { auth, currentUser } from '@clerk/nextjs/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export type AppUser = {
  id: string;
  email: string | null;
  displayName: string | null;
  legacySupabaseUserId: string | null;
};

export function isLegacySupabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export async function createServerSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Legacy Supabase environment is not configured. This path is pending D1 migration.');
  }

  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components can read but not always write cookies.
        }
      },
    },
  });
}

export async function getAuthenticatedUser() {
  const { userId } = await auth();

  if (!userId) {
    return { user: null };
  }

  const user = await currentUser();

  if (!user) {
    return { user: null };
  }

  const email = user.primaryEmailAddress?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? null;
  const fallbackName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();

  return {
    user: {
      id: user.id,
      email,
      displayName: user.fullName ?? (fallbackName || user.username) ?? email?.split('@')[0] ?? null,
      legacySupabaseUserId:
        typeof user.publicMetadata.supabase_user_id === 'string'
          ? user.publicMetadata.supabase_user_id
          : null,
    } satisfies AppUser,
  };
}
