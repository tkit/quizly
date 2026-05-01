import { NextRequest, NextResponse } from 'next/server';
import { createD1ChildProfile, ensureD1GuardianProfile } from '@/lib/auth/d1';
import { getAuthenticatedUser } from '@/lib/auth/server';
import { getOptionalD1Database } from '@/lib/cloudflare/d1';

type Body = {
  displayName?: string;
  avatarUrl?: string;
};

export async function POST(request: NextRequest) {
  const { user } = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json()) as Body;
  const displayName = body.displayName?.trim();

  if (!displayName) {
    return NextResponse.json({ error: 'displayName is required' }, { status: 400 });
  }

  const d1 = await getOptionalD1Database();
  if (!d1) {
    return NextResponse.json({ error: 'D1 binding is required' }, { status: 500 });
  }

  await ensureD1GuardianProfile(d1, user);
  const created = await createD1ChildProfile(d1, {
    guardianId: user.id,
    displayName,
    avatarUrl: body.avatarUrl ?? null,
  });

  if (!created) {
    console.error('[children-create] d1 insert completed but child could not be read');
    return NextResponse.json({ error: 'Failed to create child profile' }, { status: 500 });
  }

  return NextResponse.json({ child: created });
}
