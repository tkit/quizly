import { NextRequest, NextResponse } from 'next/server';
import { setD1ParentPinHash } from '@/lib/auth/d1';
import { getAuthenticatedUser } from '@/lib/auth/server';
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

  const parentPinHash = hashPin(body.pin);
  const d1 = await getOptionalD1Database();
  if (!d1) {
    return NextResponse.json({ error: 'D1 binding is required' }, { status: 500 });
  }

  const updated = await setD1ParentPinHash(d1, user.id, parentPinHash);
  if (!updated) {
    return NextResponse.json({ error: 'Guardian account not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
