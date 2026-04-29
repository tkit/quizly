import { NextResponse } from 'next/server';
import { getD1ParentPinHash } from '@/lib/auth/d1';
import { createServerSupabaseClient, getAuthenticatedUser } from '@/lib/auth/server';
import { getOptionalD1Database } from '@/lib/cloudflare/d1';

export async function GET() {
  const { user } = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const d1 = await getOptionalD1Database();
  if (d1) {
    const parentPinHash = await getD1ParentPinHash(d1, user.id);
    return NextResponse.json({ hasParentPin: Boolean(parentPinHash) });
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('guardian_accounts')
    .select('parent_pin_hash')
    .eq('id', user.id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ hasParentPin: Boolean(data?.parent_pin_hash) });
}
