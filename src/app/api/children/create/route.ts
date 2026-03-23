import { NextRequest, NextResponse } from 'next/server';
import { invalidateParentManagementSnapshotCache } from '@/lib/auth/data';
import { createServerSupabaseClient, getAuthenticatedUser } from '@/lib/auth/server';

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

  const supabase = await createServerSupabaseClient();

  const { data: created, error: insertError } = await supabase
    .from('child_profiles')
    .insert({
      guardian_id: user.id,
      display_name: displayName,
      avatar_url: body.avatarUrl ?? null,
      auth_mode: 'none',
      pin_hash: null,
    })
    .select('id, display_name, total_points, avatar_url')
    .single();

  if (insertError || !created) {
    return NextResponse.json({ error: insertError?.message ?? 'Failed to create child profile' }, { status: 500 });
  }

  await invalidateParentManagementSnapshotCache(user.id);
  return NextResponse.json({ child: created });
}
