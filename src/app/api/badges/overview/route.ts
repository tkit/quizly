import { NextRequest, NextResponse } from 'next/server';
import { ACTIVE_CHILD_COOKIE } from '@/lib/auth/constants';
import { createServerSupabaseClient, getAuthenticatedUser } from '@/lib/auth/server';
import { getBadgeOverview, getBadgeSummary } from '@/lib/badges/overview';

export async function GET(request: NextRequest) {
  const { user } = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const activeChildId = request.cookies.get(ACTIVE_CHILD_COOKIE)?.value;
  if (!activeChildId) {
    return NextResponse.json({ error: 'Active child is required' }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const { data: child, error: childError } = await supabase
    .from('child_profiles')
    .select('id')
    .eq('id', activeChildId)
    .single();

  if (childError || !child) {
    return NextResponse.json({ error: 'Child not found' }, { status: 404 });
  }

  try {
    const view = request.nextUrl.searchParams.get('view');
    if (view === 'summary') {
      const summary = await getBadgeSummary(supabase, { childId: activeChildId });
      return NextResponse.json(summary);
    }
    const overview = await getBadgeOverview(supabase, { childId: activeChildId });
    return NextResponse.json(overview);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load badge overview';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
