import { NextRequest, NextResponse } from 'next/server';
import { ACTIVE_CHILD_COOKIE } from '@/lib/auth/constants';
import { getD1ChildProfile } from '@/lib/auth/d1';
import { createServerSupabaseClient, getAuthenticatedUser } from '@/lib/auth/server';
import { getBadgeOverview, getBadgeSummary, getD1BadgeOverview, getD1BadgeSummary } from '@/lib/badges/overview';
import { getOptionalD1Database } from '@/lib/cloudflare/d1';

export async function GET(request: NextRequest) {
  const { user } = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const activeChildId = request.cookies.get(ACTIVE_CHILD_COOKIE)?.value;
  if (!activeChildId) {
    return NextResponse.json({ error: 'Active child is required' }, { status: 400 });
  }

  try {
    const view = request.nextUrl.searchParams.get('view');
    const d1 = await getOptionalD1Database();
    if (d1) {
      const child = await getD1ChildProfile(d1, user.id, activeChildId);
      if (!child) {
        return NextResponse.json({ error: 'Child not found' }, { status: 404 });
      }

      if (view === 'summary') {
        const summary = await getD1BadgeSummary(d1, { childId: activeChildId, guardianId: user.id });
        if (!summary) {
          return NextResponse.json({ error: 'Child not found' }, { status: 404 });
        }
        return NextResponse.json(summary);
      }

      const overview = await getD1BadgeOverview(d1, { childId: activeChildId, guardianId: user.id });
      if (!overview) {
        return NextResponse.json({ error: 'Child not found' }, { status: 404 });
      }
      return NextResponse.json(overview);
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
