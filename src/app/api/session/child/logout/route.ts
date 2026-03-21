import { NextResponse } from 'next/server';
import { ACTIVE_CHILD_COOKIE } from '@/lib/auth/constants';

export async function POST() {
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
