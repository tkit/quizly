import { NextRequest, NextResponse } from 'next/server';
import { ACTIVE_CHILD_COOKIE } from '@/lib/auth/constants';
import { deleteD1GuardianAccount, isD1ParentUnlocked } from '@/lib/auth/d1';
import { getAuthenticatedUser } from '@/lib/auth/server';
import { getOptionalD1Database } from '@/lib/cloudflare/d1';

type Body = {
  confirmation?: string;
};

export async function DELETE(request: NextRequest) {
  const { user } = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = ((await request.json().catch(() => null)) ?? {}) as Body;
  if (body.confirmation !== 'DELETE') {
    return NextResponse.json({ error: 'Confirmation token mismatch' }, { status: 400 });
  }

  const d1 = await getOptionalD1Database();
  if (!d1) {
    return NextResponse.json({ error: 'D1 binding is required' }, { status: 500 });
  }

  const unlocked = await isD1ParentUnlocked(d1, user.id);
  if (!unlocked) {
    return NextResponse.json({ error: 'Parent reauthentication required' }, { status: 403 });
  }

  const deleted = await deleteD1GuardianAccount(d1, user.id);
  if (!deleted) {
    return NextResponse.json({ error: 'Guardian account not found' }, { status: 404 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: ACTIVE_CHILD_COOKIE,
    value: '',
    maxAge: 0,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });

  return response;
}
