import { NextRequest, NextResponse } from 'next/server';
import { ACTIVE_CHILD_COOKIE } from '@/lib/auth/constants';
import { createServerSupabaseClientWithToken, getUserFromBearerHeader } from '@/lib/auth/server';

export async function GET(request: NextRequest) {
  const { user, accessToken } = await getUserFromBearerHeader(request.headers.get('authorization'));
  if (!user || !accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const activeChildId = request.cookies.get(ACTIVE_CHILD_COOKIE)?.value;
  if (!activeChildId) {
    return NextResponse.json({ child: null });
  }

  const supabase = createServerSupabaseClientWithToken(accessToken);
  const { data: child } = await supabase
    .from('child_profiles')
    .select('id, display_name, total_points, auth_mode, avatar_url')
    .eq('id', activeChildId)
    .single();

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

  return NextResponse.json({ child });
}
