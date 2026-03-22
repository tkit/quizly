import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, getAuthenticatedUser } from '@/lib/auth/server';
import { hashPin, isValidPin } from '@/lib/security/pin';

type Body = {
  pin?: string;
};

export async function POST(request: NextRequest) {
  const { user } = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json()) as Body;
  if (!body.pin || !isValidPin(body.pin)) {
    return NextResponse.json({ error: '4桁PINが必要です' }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const { data: guardian, error: guardianError } = await supabase
    .from('guardian_accounts')
    .select('parent_pin_hash')
    .eq('id', user.id)
    .single();

  if (guardianError) {
    return NextResponse.json({ error: guardianError.message }, { status: 500 });
  }

  if (!guardian?.parent_pin_hash) {
    return NextResponse.json({ error: '親PINが未設定です' }, { status: 400 });
  }

  if (hashPin(body.pin) !== guardian.parent_pin_hash) {
    return NextResponse.json({ error: 'PINが一致しません' }, { status: 403 });
  }

  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const { error } = await supabase.from('parent_reauth_challenges').insert({
    guardian_id: user.id,
    expires_at: expiresAt,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, expiresAt });
}
