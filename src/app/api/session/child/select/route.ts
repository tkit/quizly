import { NextRequest, NextResponse } from 'next/server';
import { ACTIVE_CHILD_COOKIE, COOKIE_MAX_AGE_SECONDS } from '@/lib/auth/constants';
import { getD1ChildProfile } from '@/lib/auth/d1';
import { getAuthenticatedUser } from '@/lib/auth/server';
import { getOptionalD1Database } from '@/lib/cloudflare/d1';

type Body = {
  childId?: string;
};

export async function POST(request: NextRequest) {
  const { user } = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json()) as Body;
  if (!body.childId) {
    return NextResponse.json({ error: 'childId is required' }, { status: 400 });
  }

  const d1 = await getOptionalD1Database();
  if (!d1) {
    return NextResponse.json({ error: 'D1 binding is required' }, { status: 500 });
  }

  const child = await getD1ChildProfile(d1, user.id, body.childId);
  if (!child) {
    return NextResponse.json({ error: 'Child not found' }, { status: 404 });
  }

  const response = NextResponse.json({ ok: true, childId: child.id, childName: child.display_name });
  response.cookies.set({
    name: ACTIVE_CHILD_COOKIE,
    value: child.id,
    maxAge: COOKIE_MAX_AGE_SECONDS,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });

  return response;
}
