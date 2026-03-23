import { NextRequest, NextResponse } from 'next/server';
import { ACTIVE_CHILD_COOKIE } from '@/lib/auth/constants';
import { invalidateParentManagementSnapshotCache, isParentUnlocked } from '@/lib/auth/data';
import { createServerSupabaseClient, getAuthenticatedUser } from '@/lib/auth/server';

type Body = {
  displayName?: string;
};

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user } = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json()) as Body;
  const displayName = body.displayName?.trim();
  if (!displayName) {
    return NextResponse.json({ error: 'displayName is required' }, { status: 400 });
  }

  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const unlocked = await isParentUnlocked(supabase, user.id);
  if (!unlocked) {
    return NextResponse.json({ error: 'Parent reauthentication required' }, { status: 403 });
  }

  const { data: child, error } = await supabase
    .from('child_profiles')
    .update({ display_name: displayName })
    .eq('id', id)
    .select('id, display_name, total_points, avatar_url, created_at')
    .single();

  if (error || !child) {
    return NextResponse.json({ error: error?.message ?? 'Child not found' }, { status: 404 });
  }

  await invalidateParentManagementSnapshotCache(user.id);
  return NextResponse.json({ child });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user } = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const unlocked = await isParentUnlocked(supabase, user.id);
  if (!unlocked) {
    return NextResponse.json({ error: 'Parent reauthentication required' }, { status: 403 });
  }

  const { error } = await supabase.from('child_profiles').delete().eq('id', id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await invalidateParentManagementSnapshotCache(user.id);
  const response = NextResponse.json({ ok: true });
  if (request.cookies.get(ACTIVE_CHILD_COOKIE)?.value === id) {
    response.cookies.set({
      name: ACTIVE_CHILD_COOKIE,
      value: '',
      maxAge: 0,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    });
  }

  return response;
}
