import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClientWithToken, getUserFromBearerHeader } from '@/lib/auth/server';

export async function GET(request: NextRequest) {
  const { user, accessToken } = await getUserFromBearerHeader(request.headers.get('authorization'));
  if (!user || !accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServerSupabaseClientWithToken(accessToken);
  const { data, error } = await supabase
    .from('guardian_accounts')
    .select('parent_pin_hash')
    .eq('id', user.id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ hasParentPin: Boolean(data?.parent_pin_hash) });
}
