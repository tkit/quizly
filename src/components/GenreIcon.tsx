import {
  Bug,
  BookMarked,
  BookOpen,
  Calculator,
  Clock3,
  FlaskConical,
  Landmark,
  Map,
  MessageCircle,
  Microscope,
  NotebookPen,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const ICON_BY_KEY = {
  calculator: Calculator,
  book_open: BookOpen,
  book_marked: BookMarked,
  map: Map,
  landmark: Landmark,
  microscope: Microscope,
  flask: FlaskConical,
  bug: Bug,
  notebook: NotebookPen,
  message: MessageCircle,
  clock: Clock3,
} as const;

export type GenreIconKey = keyof typeof ICON_BY_KEY;

type GenreIconProps = {
  iconKey: string;
  className?: string;
  strokeWidth?: number;
};

export function GenreIcon({ iconKey, className, strokeWidth = 2.25 }: GenreIconProps) {
  const Icon = ICON_BY_KEY[iconKey as GenreIconKey] || BookOpen;
  return <Icon className={cn('text-zinc-700', className)} strokeWidth={strokeWidth} aria-hidden="true" />;
}
