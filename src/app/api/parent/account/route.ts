import { NextRequest, NextResponse } from 'next/server';
import { ACTIVE_CHILD_COOKIE } from '@/lib/auth/constants';
import { invalidateParentManagementSnapshotCache, isParentUnlocked } from '@/lib/auth/data';
import { deleteD1GuardianAccount, isD1ParentUnlocked } from '@/lib/auth/d1';
import { createServerSupabaseClient, getAuthenticatedUser } from '@/lib/auth/server';
import { getOptionalD1Database } from '@/lib/cloudflare/d1';

type Body = {
  confirmation?: string;
};

export async function DELETE(request: NextRequest) {
  const { user } = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = ((await request.json().catch(() => null)) ?? {}) as Body;
  if (body.confirmation !== 'DELETE') {
    return NextResponse.json({ error: 'Confirmation token mismatch' }, { status: 400 });
  }

  const d1 = await getOptionalD1Database();
  if (d1) {
    const unlocked = await isD1ParentUnlocked(d1, user.id);
    if (!unlocked) {
      return NextResponse.json({ error: 'Parent reauthentication required' }, { status: 403 });
    }

    const deleted = await deleteD1GuardianAccount(d1, user.id);
    if (!deleted) {
      return NextResponse.json({ error: 'Guardian account not found' }, { status: 404 });
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set({
      name: ACTIVE_CHILD_COOKIE,
      value: '',
      maxAge: 0,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    });

    return response;
  }

  const supabase = await createServerSupabaseClient();
  const unlocked = await isParentUnlocked(supabase, user.id);
  if (!unlocked) {
    return NextResponse.json({ error: 'Parent reauthentication required' }, { status: 403 });
  }

  const { error } = await supabase.from('guardian_accounts').delete().eq('id', user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await invalidateParentManagementSnapshotCache(user.id);
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: ACTIVE_CHILD_COOKIE,
    value: '',
    maxAge: 0,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });

  return response;
}
