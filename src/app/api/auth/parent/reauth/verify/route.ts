import { NextResponse } from 'next/server';
import { getParentReauthSessionExpiresAt } from '@/lib/auth/parentReauth';
import { createServerSupabaseClient, getAuthenticatedUser } from '@/lib/auth/server';

export async function GET() {
  const { user } = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createServerSupabaseClient();
  try {
    const expiresAt = await getParentReauthSessionExpiresAt(supabase, user.id);
    return NextResponse.json({ verified: Boolean(expiresAt), expiresAt: expiresAt ?? null });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to verify parent session';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
