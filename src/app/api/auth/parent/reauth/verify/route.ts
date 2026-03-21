import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClientWithToken, getUserFromBearerHeader } from '@/lib/auth/server';

export async function GET(request: NextRequest) {
  const { user, accessToken } = await getUserFromBearerHeader(request.headers.get('authorization'));
  if (!user || !accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServerSupabaseClientWithToken(accessToken);
  const { data, error } = await supabase
    .from('parent_reauth_challenges')
    .select('expires_at')
    .eq('guardian_id', user.id)
    .gt('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ verified: Boolean(data), expiresAt: data?.expires_at ?? null });
}
