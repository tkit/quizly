import Link from 'next/link';
import { CircleAlert, CircleCheckBig, CircleHelp, TriangleAlert } from 'lucide-react';
import { ICON_SIZE, ICON_STROKE } from '@/lib/ui/iconTokens';

type MessageTone = 'error' | 'warning' | 'info' | 'success';

type MessageCardProps = {
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  tone?: MessageTone;
};

export default function MessageCard({
  title,
  description,
  actionLabel,
  actionHref,
  tone = 'info',
}: MessageCardProps) {
  const toneStyles = {
    error: {
      titleClass: 'text-rose-700',
      panelClass: 'bg-rose-50',
      buttonClass: 'bg-rose-200 hover:bg-rose-300',
      icon: <CircleAlert className={ICON_SIZE.md} strokeWidth={ICON_STROKE.medium} />,
    },
    warning: {
      titleClass: 'text-amber-700',
      panelClass: 'bg-amber-50',
      buttonClass: 'bg-amber-200 hover:bg-amber-300',
      icon: <TriangleAlert className={ICON_SIZE.md} strokeWidth={ICON_STROKE.medium} />,
    },
    info: {
      titleClass: 'text-sky-700',
      panelClass: 'bg-sky-50',
      buttonClass: 'bg-sky-200 hover:bg-sky-300',
      icon: <CircleHelp className={ICON_SIZE.md} strokeWidth={ICON_STROKE.medium} />,
    },
    success: {
      titleClass: 'text-teal-700',
      panelClass: 'bg-teal-50',
      buttonClass: 'bg-teal-300 hover:bg-teal-400',
      icon: <CircleCheckBig className={ICON_SIZE.md} strokeWidth={ICON_STROKE.medium} />,
    },
  } as const;
  const currentTone = toneStyles[tone];

  return (
    <div className={`w-full max-w-xl rounded-[2rem] border-4 border-zinc-400 p-6 text-center shadow-brutal ${currentTone.panelClass} sm:p-8`}>
      <p className={`mb-3 inline-flex items-center gap-2 text-[clamp(1.2rem,5vw,1.5rem)] font-black ${currentTone.titleClass}`}>
        {currentTone.icon}
        {title}
      </p>
      {description && <p className="text-base font-bold text-zinc-600 sm:text-lg">{description}</p>}
      {actionLabel && actionHref && (
        <div className="mt-6">
          <Link
            href={actionHref}
            className={`inline-flex min-h-11 items-center justify-center rounded-full border-4 border-zinc-400 px-8 py-2 font-black text-zinc-900 shadow-brutal ${currentTone.buttonClass}`}
          >
            {actionLabel}
          </Link>
        </div>
      )}
    </div>
  );
}
