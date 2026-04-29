import { NextResponse } from 'next/server';
import { getParentReauthSessionExpiresAt } from '@/lib/auth/parentReauth';
import { getD1ParentReauthSessionExpiresAt } from '@/lib/auth/d1';
import { createServerSupabaseClient, getAuthenticatedUser } from '@/lib/auth/server';
import { getOptionalD1Database } from '@/lib/cloudflare/d1';

export async function GET() {
  const { user } = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const d1 = await getOptionalD1Database();
    if (d1) {
      const expiresAt = await getD1ParentReauthSessionExpiresAt(d1, user.id);
      return NextResponse.json({ verified: Boolean(expiresAt), expiresAt: expiresAt ?? null });
    }

    const supabase = await createServerSupabaseClient();
    const expiresAt = await getParentReauthSessionExpiresAt(supabase, user.id);
    return NextResponse.json({ verified: Boolean(expiresAt), expiresAt: expiresAt ?? null });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to verify parent session';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
