export const ACTIVE_CHILD_COOKIE = 'quizly_active_child';

export const AUTH_MODE = process.env.NEXT_PUBLIC_AUTH_MODE ?? 'production';
export const DEV_SHORTCUT_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_DEV_AUTH_SHORTCUT === 'true' &&
  process.env.NODE_ENV !== 'production';

export const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
