import { auth } from '@/auth';
import { DEV_SHORTCUT_ENABLED } from '@/lib/auth/constants';

export type AppUser = {
  id: string;
  email: string | null;
  displayName: string | null;
};

let warnedMissingLocalAuthConfig = false;

function isNextDynamicServerError(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const digest = 'digest' in error ? error.digest : undefined;
  return digest === 'DYNAMIC_SERVER_USAGE';
}

export async function getAuthenticatedUser() {
  if (
    DEV_SHORTCUT_ENABLED &&
    (!process.env.GOOGLE_OAUTH_CLIENT_ID || !process.env.GOOGLE_OAUTH_CLIENT_SECRET || !process.env.AUTH_SECRET)
  ) {
    if (!warnedMissingLocalAuthConfig) {
      console.warn('[auth] local OAuth configuration is missing; treating request as signed out.');
      warnedMissingLocalAuthConfig = true;
    }
    return { user: null };
  }

  let session;
  try {
    session = await auth();
  } catch (error) {
    if (isNextDynamicServerError(error)) {
      throw error;
    }

    const message = error instanceof Error ? error.message : String(error);
    if (process.env.NODE_ENV === 'development' && /is required|D1 binding/.test(message)) {
      console.warn('[auth] session lookup skipped:', message);
    } else {
      console.error('[auth] failed to read session', error);
    }
    return { user: null };
  }

  const user = session?.user;

  if (!user?.id) {
    return { user: null };
  }

  return {
    user: {
      id: user.id,
      email: user.email ?? null,
      displayName: user.name ?? user.email?.split('@')[0] ?? null,
    } satisfies AppUser,
  };
}
