import NextAuth, { type NextAuthConfig } from 'next-auth';
import type { Adapter } from 'next-auth/adapters';
import Google from 'next-auth/providers/google';
import { D1Adapter } from '@auth/d1-adapter';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { ensureD1GuardianProfile } from '@/lib/auth/d1';
import { AUTH_SESSION_COOKIE, COOKIE_MAX_AGE_SECONDS, AUTH_SESSION_ROTATION_SECONDS } from '@/lib/auth/constants';

function requireValue(name: string, value: string | undefined) {
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

async function buildAuthConfig(): Promise<NextAuthConfig> {
  const { env } = await getCloudflareContext({ async: true });
  const db = env.DB;

  if (!db) {
    throw new Error('D1 binding is required');
  }

  const adapter = createQuizlyD1Adapter(db);

  return {
    adapter,
    providers: [
      Google({
        clientId: requireValue('GOOGLE_OAUTH_CLIENT_ID', env.GOOGLE_OAUTH_CLIENT_ID ?? process.env.GOOGLE_OAUTH_CLIENT_ID),
        clientSecret: requireValue('GOOGLE_OAUTH_CLIENT_SECRET', env.GOOGLE_OAUTH_CLIENT_SECRET ?? process.env.GOOGLE_OAUTH_CLIENT_SECRET),
        allowDangerousEmailAccountLinking: false,
      }),
    ],
    secret: requireValue('AUTH_SECRET', env.AUTH_SECRET ?? process.env.AUTH_SECRET),
    session: {
      strategy: 'database',
      maxAge: COOKIE_MAX_AGE_SECONDS,
      updateAge: AUTH_SESSION_ROTATION_SECONDS,
    },
    cookies: {
      sessionToken: {
        name: AUTH_SESSION_COOKIE,
        options: {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          secure: true,
        },
      },
    },
    callbacks: {
      signIn({ account, profile }) {
        if (account?.provider === 'google' && profile?.email_verified !== true) {
          return false;
        }

        return true;
      },
      session({ session, user }) {
        if (session.user && user.id) {
          session.user.id = user.id;
        }
        return session;
      },
    },
    events: {
      async signIn({ user }) {
        if (!user.id) {
          return;
        }

        await ensureD1GuardianProfile(db, {
          id: user.id,
          email: user.email ?? null,
          displayName: user.name ?? user.email?.split('@')[0] ?? null,
        });
      },
    },
    trustHost: true,
  };
}

function createQuizlyD1Adapter(db: D1Database): Adapter {
  const adapter = D1Adapter(db);

  return {
    ...adapter,
    async createUser(user) {
      if (!user.email) {
        if (!adapter.createUser) {
          throw new Error('Auth.js D1 adapter createUser is unavailable');
        }
        return adapter.createUser(user);
      }

      const existingGuardians = await db
        .prepare(
          `
          SELECT id
          FROM guardian_accounts
          WHERE email IS NOT NULL AND lower(email) = lower(?)
          ORDER BY created_at ASC
        `,
        )
        .bind(user.email)
        .all<{ id: string }>();
      const rows = existingGuardians.results ?? [];

      if (rows.length > 1) {
        throw new Error('Multiple guardian accounts share this email address');
      }

      if (rows.length === 0) {
        if (!adapter.createUser) {
          throw new Error('Auth.js D1 adapter createUser is unavailable');
        }
        return adapter.createUser(user);
      }

      const id = rows[0].id;
      await db
        .prepare(
          `
          INSERT INTO users (id, name, email, emailVerified, image)
          VALUES (?, ?, ?, ?, ?)
        `,
        )
        .bind(id, user.name ?? null, user.email, user.emailVerified?.toISOString() ?? null, user.image ?? null)
        .run();

      const created = await db
        .prepare('SELECT id, name, email, emailVerified, image FROM users WHERE id = ? LIMIT 1')
        .bind(id)
        .first<{ id: string; name: string | null; email: string | null; emailVerified: string | null; image: string | null }>();

      if (!created) {
        throw new Error('Failed to create Auth.js user for existing guardian');
      }

      return {
        id: created.id,
        name: created.name,
        email: created.email ?? user.email,
        emailVerified: created.emailVerified ? new Date(created.emailVerified) : null,
        image: created.image,
      };
    },
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth(async () => buildAuthConfig());
