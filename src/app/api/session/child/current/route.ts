import { NextRequest, NextResponse } from 'next/server';
import { ACTIVE_CHILD_COOKIE } from '@/lib/auth/constants';
import { getD1ChildProfile } from '@/lib/auth/d1';
import { createServerSupabaseClient, getAuthenticatedUser } from '@/lib/auth/server';
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
  if (d1) {
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

  const supabase = await createServerSupabaseClient();
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
