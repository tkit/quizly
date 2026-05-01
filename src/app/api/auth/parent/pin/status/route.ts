import { NextResponse } from 'next/server';
import { getD1ParentPinHash } from '@/lib/auth/d1';
import { getAuthenticatedUser } from '@/lib/auth/server';
import { getOptionalD1Database } from '@/lib/cloudflare/d1';

export async function GET() {
  const { user } = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const d1 = await getOptionalD1Database();
  if (!d1) {
    return NextResponse.json({ error: 'D1 binding is required' }, { status: 500 });
  }

  const parentPinHash = await getD1ParentPinHash(d1, user.id);
  return NextResponse.json({ hasParentPin: Boolean(parentPinHash) });
}
