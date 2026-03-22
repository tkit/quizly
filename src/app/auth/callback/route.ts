import { NextRequest, NextResponse } from 'next/server';
import { ACTIVE_CHILD_COOKIE, COOKIE_MAX_AGE_SECONDS } from '@/lib/auth/constants';
import { ensureGuardianProfile, listChildProfiles } from '@/lib/auth/data';
import { createServerSupabaseClient } from '@/lib/auth/server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const redirectUrl = new URL('/', request.url);

  if (!code) {
    return NextResponse.redirect(redirectUrl);
  }

  const supabase = await createServerSupabaseClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    return NextResponse.redirect(redirectUrl);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(redirectUrl);
  }

  await ensureGuardianProfile(supabase, user);

  const activeChildId = request.cookies.get(ACTIVE_CHILD_COOKIE)?.value ?? null;
  if (activeChildId) {
    const { data: activeChild } = await supabase
      .from('child_profiles')
      .select('id')
      .eq('id', activeChildId)
      .maybeSingle();

    if (activeChild) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  const children = await listChildProfiles(supabase);
  if (children.length === 1) {
    const response = NextResponse.redirect(new URL('/dashboard', request.url));
    response.cookies.set({
      name: ACTIVE_CHILD_COOKIE,
      value: children[0].id,
      maxAge: COOKIE_MAX_AGE_SECONDS,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    });
    return response;
  }

  return NextResponse.redirect(redirectUrl);
}
