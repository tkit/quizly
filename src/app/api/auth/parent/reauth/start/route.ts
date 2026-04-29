import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, getAuthenticatedUser } from '@/lib/auth/server';
import { createD1ParentReauthSession, getD1ParentPinHash } from '@/lib/auth/d1';
import {
  clearParentPinAttemptState,
  createParentReauthSession,
  getParentPinCooldownSeconds,
  registerParentPinFailure,
} from '@/lib/auth/parentReauth';
import { getOptionalD1Database } from '@/lib/cloudflare/d1';
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

  const cooldownSeconds = await getParentPinCooldownSeconds(user.id);

  if (cooldownSeconds > 0) {
    return NextResponse.json(
      { error: `PIN入力の失敗が続いたため、しばらく待ってから再試行してください（約${cooldownSeconds}秒）` },
      { status: 429 },
    );
  }

  const d1 = await getOptionalD1Database();
  if (d1) {
    const parentPinHash = await getD1ParentPinHash(d1, user.id);
    if (!parentPinHash) {
      return NextResponse.json({ error: '親PINが未設定です' }, { status: 400 });
    }

    if (hashPin(body.pin) !== parentPinHash) {
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
    const expiresAt = await createD1ParentReauthSession(d1, user.id);

    return NextResponse.json({ ok: true, expiresAt });
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
