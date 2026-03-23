import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, getAuthenticatedUser } from '@/lib/auth/server';
import {
  clearParentPinAttemptState,
  createParentReauthSession,
  getParentPinCooldownSeconds,
  registerParentPinFailure,
} from '@/lib/auth/parentReauth';
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
  const cooldownSeconds = await getParentPinCooldownSeconds(user.id);

  if (cooldownSeconds > 0) {
    return NextResponse.json(
      { error: `PIN入力の失敗が続いたため、しばらく待ってから再試行してください（約${cooldownSeconds}秒）` },
      { status: 429 },
    );
  }

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
    const result = await registerParentPinFailure(user.id, request.headers.get('x-forwarded-for'));
    if (result.locked) {
      return NextResponse.json(
        { error: `PIN入力の失敗が続いたため、${result.retryAfterSeconds}秒後に再試行してください` },
        { status: 429 },
      );
    }

    return NextResponse.json({ error: 'PINが一致しません' }, { status: 403 });
  }

  await clearParentPinAttemptState(user.id, request.headers.get('x-forwarded-for'));
  const expiresAt = await createParentReauthSession(supabase, user.id);

  return NextResponse.json({ ok: true, expiresAt });
}
