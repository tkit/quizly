import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import HomeClient from './HomeClient';
import PageShell from '@/components/layout/PageShell';
import { ACTIVE_CHILD_COOKIE } from '@/lib/auth/constants';

export default async function Home() {
  const cookieStore = await cookies();
  const activeChildId = cookieStore.get(ACTIVE_CHILD_COOKIE)?.value;

  if (activeChildId) {
    redirect('/dashboard');
  }

  return (
    <PageShell maxWidthClass="max-w-4xl" mainClassName="flex flex-col items-center gap-8 pt-6 sm:pt-10">
      <HomeClient />
    </PageShell>
  );
}
