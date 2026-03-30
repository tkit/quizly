import type { ReactNode } from 'react';

type PageShellProps = {
  children: ReactNode;
  maxWidthClass?: string;
  mainClassName?: string;
};

export default function PageShell({
  children,
  maxWidthClass = 'max-w-4xl',
  mainClassName = 'flex flex-col gap-8',
}: PageShellProps) {
  return (
    <div className="flex min-h-screen-safe flex-col items-center bg-background px-4 py-5 text-foreground sm:px-6 sm:py-8 lg:px-8">
      <main className={`w-full ${maxWidthClass} ${mainClassName}`}>{children}</main>
    </div>
  );
}
