import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClientWithToken, getUserFromBearerHeader } from '@/lib/auth/server';
import { hashPin, isValidPin } from '@/lib/security/pin';

type Body = {
  pin?: string;
};

export async function POST(request: NextRequest) {
  const { user, accessToken } = await getUserFromBearerHeader(request.headers.get('authorization'));
  if (!user || !accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json()) as Body;
  if (!body.pin || !isValidPin(body.pin)) {
    return NextResponse.json({ error: '4桁PINが必要です' }, { status: 400 });
  }

  const supabase = createServerSupabaseClientWithToken(accessToken);
  const { error } = await supabase
    .from('guardian_accounts')
    .update({ parent_pin_hash: hashPin(body.pin) })
    .eq('id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
