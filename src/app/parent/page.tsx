import ParentClient from './ParentClient';
import PageShell from '@/components/layout/PageShell';

export default function ParentPage() {
  return (
    <PageShell maxWidthClass="max-w-4xl" mainClassName="flex flex-col items-center gap-8 pt-6 sm:pt-10">
      <ParentClient />
    </PageShell>
  );
}
