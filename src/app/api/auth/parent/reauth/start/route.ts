import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { getAuthenticatedUser } from '@/lib/auth/server';
import {
  clearD1ParentPinAttemptState,
  createD1ParentReauthSession,
  getD1ParentPinCooldownSeconds,
  getD1ParentPinHash,
  registerD1ParentPinFailure,
} from '@/lib/auth/d1';
import { getOptionalD1Database } from '@/lib/cloudflare/d1';
import { hashPin, isValidPin } from '@/lib/security/pin';

type Body = {
  pin?: string;
};

function extractClientIp(rawIp: string | null) {
  if (!rawIp) return null;
  return rawIp.split(',')[0]?.trim() ?? null;
}

function hashIpAddress(ipAddress: string | null) {
  if (!ipAddress) return null;
  return createHash('sha256').update(ipAddress).digest('hex').slice(0, 16);
}

export async function POST(request: NextRequest) {
  const { user } = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json()) as Body;
  if (!body.pin || !isValidPin(body.pin)) {
    return NextResponse.json({ error: '4桁PINが必要です' }, { status: 400 });
  }

  const d1 = await getOptionalD1Database();
  if (!d1) {
    return NextResponse.json({ error: 'D1 binding is required' }, { status: 500 });
  }

  const ipHash = hashIpAddress(extractClientIp(request.headers.get('x-forwarded-for')));
  const cooldownSeconds = await getD1ParentPinCooldownSeconds(d1, user.id);
  if (cooldownSeconds > 0) {
    return NextResponse.json(
      { error: `PIN入力の失敗が続いたため、しばらく待ってから再試行してください（約${cooldownSeconds}秒）` },
      { status: 429 },
    );
  }

  const parentPinHash = await getD1ParentPinHash(d1, user.id);
  if (!parentPinHash) {
    return NextResponse.json({ error: '親PINが未設定です' }, { status: 400 });
  }

  if (hashPin(body.pin) !== parentPinHash) {
    const result = await registerD1ParentPinFailure(d1, user.id, ipHash);
    if (result.locked) {
      return NextResponse.json(
        { error: `PIN入力の失敗が続いたため、${result.retryAfterSeconds}秒後に再試行してください` },
        { status: 429 },
      );
    }

    return NextResponse.json({ error: 'PINが一致しません' }, { status: 403 });
  }

  await clearD1ParentPinAttemptState(d1, user.id, ipHash);
  const expiresAt = await createD1ParentReauthSession(d1, user.id);

  return NextResponse.json({ ok: true, expiresAt });
}
