import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/server';
import { createD1ParentReauthSession, getD1ParentPinHash } from '@/lib/auth/d1';
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

  const d1 = await getOptionalD1Database();
  if (!d1) {
    return NextResponse.json({ error: 'D1 binding is required' }, { status: 500 });
  }

  const parentPinHash = await getD1ParentPinHash(d1, user.id);
  if (!parentPinHash) {
    return NextResponse.json({ error: '親PINが未設定です' }, { status: 400 });
  }

  if (hashPin(body.pin) !== parentPinHash) {
    return NextResponse.json({ error: 'PINが一致しません' }, { status: 403 });
  }

  const expiresAt = await createD1ParentReauthSession(d1, user.id);

  return NextResponse.json({ ok: true, expiresAt });
}
