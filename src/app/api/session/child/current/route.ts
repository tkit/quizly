import { NextRequest, NextResponse } from 'next/server';
import { ACTIVE_CHILD_COOKIE } from '@/lib/auth/constants';
import { getD1ChildProfile } from '@/lib/auth/d1';
import { getAuthenticatedUser } from '@/lib/auth/server';
import { getOptionalD1Database } from '@/lib/cloudflare/d1';

export async function GET(request: NextRequest) {
  const { user } = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const activeChildId = request.cookies.get(ACTIVE_CHILD_COOKIE)?.value;
  if (!activeChildId) {
    return NextResponse.json({ child: null });
  }

  const d1 = await getOptionalD1Database();
  if (!d1) {
    return NextResponse.json({ error: 'D1 binding is required' }, { status: 500 });
  }

  const child = await getD1ChildProfile(d1, user.id, activeChildId);
  if (!child) {
    const response = NextResponse.json({ child: null });
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

  return NextResponse.json({ child: { ...child, auth_mode: 'none' } });
}
