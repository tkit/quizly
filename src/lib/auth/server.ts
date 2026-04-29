import { auth, currentUser } from '@clerk/nextjs/server';

export type AppUser = {
  id: string;
  email: string | null;
  displayName: string | null;
};

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
    } satisfies AppUser,
  };
}
