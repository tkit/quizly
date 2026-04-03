'use client';

import { useEffect, useRef, useState } from 'react';

type StudyHeatmapCell = {
  dateKey: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
  column: number;
  weekday: number;
};

type StudyHeatmapProps = {
  cells: StudyHeatmapCell[];
  todayKey: string;
  monthLabels: string[];
  periodLabel: string;
};

const TOKYO_TIMEZONE = 'Asia/Tokyo';
const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'] as const;

function heatmapCellClass(level: StudyHeatmapCell['level']) {
  if (level === 0) return 'bg-zinc-100 border-zinc-200';
  if (level === 1) return 'bg-emerald-100 border-emerald-200';
  if (level === 2) return 'bg-emerald-200 border-emerald-300';
  if (level === 3) return 'bg-emerald-400 border-emerald-500';
  return 'bg-emerald-600 border-emerald-700';
}

function parseDateKeyToUtcNoon(key: string) {
  const [year, month, day] = key.split('-').map((value) => Number(value));
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
}

function formatCalendarDateLabel(dateKey: string) {
  const date = parseDateKeyToUtcNoon(dateKey);
  return new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    timeZone: TOKYO_TIMEZONE,
  }).format(date);
}

function formatHeatmapTooltipLabel(dateKey: string, count: number) {
  const date = parseDateKeyToUtcNoon(dateKey);
  const dateText = new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    timeZone: TOKYO_TIMEZONE,
  }).format(date);
  return `${dateText}: ${count}回学習`;
}

export default function StudyHeatmap({ cells, todayKey, monthLabels, periodLabel }: StudyHeatmapProps) {
  const [activeTooltipId, setActiveTooltipId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const weeks = monthLabels.length;

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setActiveTooltipId(null);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, []);

  return (
    <>
      <p className="text-sm font-black text-zinc-900">学習カレンダー（過去{weeks}週間）</p>
      {periodLabel && <p className="mt-1 text-xs font-bold text-zinc-600">{periodLabel}</p>}
      <div className="mt-3 overflow-x-auto" ref={containerRef}>
        <div className="mx-auto inline-grid min-w-max gap-x-1 gap-y-1" style={{ gridTemplateColumns: `1.5rem repeat(${weeks}, minmax(0, 1rem))` }}>
          <div />
          {Array.from({ length: weeks }).map((_, weekIndex) => (
            <div key={`week-label-${weekIndex}`} className="text-center text-[10px] font-bold text-zinc-500">
              {monthLabels[weekIndex]}
            </div>
          ))}
          {WEEKDAY_LABELS.map((label, weekday) => (
            <div key={`row-${label}`} className="contents">
              <div key={`weekday-${label}`} className="pr-1 text-right text-[10px] font-bold text-zinc-500">
                {weekday === 1 || weekday === 3 || weekday === 5 ? label : ''}
              </div>
              {Array.from({ length: weeks }).map((_, column) => {
                const cell = cells.find((item) => item.weekday === weekday && item.column === column) ?? null;
                const count = cell?.count ?? 0;
                const dateLabel = cell ? formatCalendarDateLabel(cell.dateKey) : '';
                const isFutureCell = cell ? cell.dateKey > todayKey : false;
                const tooltipLabel = cell && !isFutureCell ? formatHeatmapTooltipLabel(cell.dateKey, count) : null;
                const tooltipId = cell ? `cell-${cell.dateKey}-${weekday}-${column}` : null;
                const isActive = Boolean(tooltipId && activeTooltipId === tooltipId);

                return (
                  <div key={`cell-${weekday}-${column}`} className="group/cell relative">
                    <button
                      type="button"
                      className={`h-4 w-4 rounded-[3px] border ${heatmapCellClass(cell?.level ?? 0)} cursor-default appearance-none`}
                      aria-label={cell ? (isFutureCell ? `${dateLabel}: 未到来` : `${dateLabel}: ${count}回`) : '記録なし'}
                      onClick={() => {
                        if (!tooltipId || !tooltipLabel) return;
                        setActiveTooltipId((prev) => (prev === tooltipId ? null : tooltipId));
                      }}
                      onBlur={() => {
                        setActiveTooltipId((prev) => (prev === tooltipId ? null : prev));
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                          setActiveTooltipId(null);
                        }
                      }}
                    />
                    {tooltipLabel && (
                      <span
                        className={`pointer-events-none absolute -top-8 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-md bg-zinc-800 px-2 py-1 text-[11px] font-bold text-white shadow-lg ${
                          isActive ? 'block' : 'hidden group-hover/cell:block group-focus-within/cell:block'
                        }`}
                      >
                        {tooltipLabel}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-end gap-1 text-[10px] font-bold text-zinc-600">
        <span>少ない</span>
        {[0, 1, 2, 3, 4].map((level) => (
          <span key={`legend-${level}`} className={`h-4 w-4 rounded-[3px] border ${heatmapCellClass(level as StudyHeatmapCell['level'])}`} />
        ))}
        <span>多い</span>
      </div>
    </>
  );
}
