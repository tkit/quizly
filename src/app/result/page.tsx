import { Suspense } from 'react';
import ResultPageClient from './ResultPageClient';
import PageShell from '@/components/layout/PageShell';

export default function ResultPage() {
  return (
    <Suspense
      fallback={
        <PageShell maxWidthClass="max-w-3xl" mainClassName="flex flex-1 items-center justify-center">
          <p className="text-lg font-black text-zinc-700">結果を読み込み中...</p>
        </PageShell>
      }
    >
      <ResultPageClient />
    </Suspense>
  );
}
