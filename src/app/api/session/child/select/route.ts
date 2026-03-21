import { NextRequest, NextResponse } from 'next/server';
import { ACTIVE_CHILD_COOKIE, COOKIE_MAX_AGE_SECONDS } from '@/lib/auth/constants';
import { createServerSupabaseClientWithToken, getUserFromBearerHeader } from '@/lib/auth/server';

type Body = {
  childId?: string;
};

export async function POST(request: NextRequest) {
  const { user, accessToken } = await getUserFromBearerHeader(request.headers.get('authorization'));
  if (!user || !accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json()) as Body;
  if (!body.childId) {
    return NextResponse.json({ error: 'childId is required' }, { status: 400 });
  }

  const supabase = createServerSupabaseClientWithToken(accessToken);
  const { data: child, error } = await supabase
    .from('child_profiles')
    .select('id, display_name')
    .eq('id', body.childId)
    .single();

  if (error || !child) {
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
