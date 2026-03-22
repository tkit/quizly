export type SubjectToneId = 'math' | 'japanese' | 'social' | 'science';

export type SubjectToneClasses = {
  iconBgClass: string;
  stripClass: string;
  badgeClass: string;
  arrowClass: string;
  focusRingClass: string;
  cardClass: string;
  progressClass: string;
  ctaClass: string;
  ctaHoverClass: string;
  accentTextClass: string;
  accentSoftClass: string;
  correctClass: string;
};

const SUBJECT_TONE_BY_ID: Record<SubjectToneId, SubjectToneClasses> = {
  japanese: {
    iconBgClass: 'bg-rose-200 group-hover:bg-rose-300',
    stripClass: 'bg-rose-400',
    badgeClass: 'border-rose-300 bg-rose-50 text-rose-900',
    arrowClass: 'text-rose-400 group-hover:text-rose-600',
    focusRingClass: 'focus:ring-rose-500',
    cardClass: 'bg-rose-50/55 hover:bg-rose-100/70',
    progressClass: 'bg-rose-400',
    ctaClass: 'bg-rose-100 text-rose-900',
    ctaHoverClass: 'hover:bg-rose-200',
    accentTextClass: 'text-rose-700',
    accentSoftClass: 'bg-rose-100',
    correctClass: 'border-rose-500 bg-rose-100 text-rose-800',
  },
  math: {
    iconBgClass: 'bg-blue-200 group-hover:bg-blue-300',
    stripClass: 'bg-blue-400',
    badgeClass: 'border-blue-300 bg-blue-50 text-blue-900',
    arrowClass: 'text-blue-400 group-hover:text-blue-600',
    focusRingClass: 'focus:ring-blue-500',
    cardClass: 'bg-blue-50/55 hover:bg-blue-100/70',
    progressClass: 'bg-blue-400',
    ctaClass: 'bg-blue-100 text-blue-900',
    ctaHoverClass: 'hover:bg-blue-200',
    accentTextClass: 'text-blue-700',
    accentSoftClass: 'bg-blue-100',
    correctClass: 'border-blue-500 bg-blue-100 text-blue-800',
  },
  social: {
    iconBgClass: 'bg-green-200 group-hover:bg-green-300',
    stripClass: 'bg-green-400',
    badgeClass: 'border-green-300 bg-green-50 text-green-900',
    arrowClass: 'text-green-400 group-hover:text-green-600',
    focusRingClass: 'focus:ring-green-500',
    cardClass: 'bg-green-50/55 hover:bg-green-100/70',
    progressClass: 'bg-green-400',
    ctaClass: 'bg-green-100 text-green-900',
    ctaHoverClass: 'hover:bg-green-200',
    accentTextClass: 'text-green-700',
    accentSoftClass: 'bg-green-100',
    correctClass: 'border-green-500 bg-green-100 text-green-800',
  },
  science: {
    iconBgClass: 'bg-orange-200 group-hover:bg-orange-300',
    stripClass: 'bg-orange-400',
    badgeClass: 'border-orange-300 bg-orange-50 text-orange-900',
    arrowClass: 'text-orange-400 group-hover:text-orange-600',
    focusRingClass: 'focus:ring-orange-500',
    cardClass: 'bg-orange-50/60 hover:bg-orange-100/75',
    progressClass: 'bg-orange-400',
    ctaClass: 'bg-orange-100 text-orange-900',
    ctaHoverClass: 'hover:bg-orange-200',
    accentTextClass: 'text-orange-700',
    accentSoftClass: 'bg-orange-100',
    correctClass: 'border-orange-500 bg-orange-100 text-orange-800',
  },
};

const COLOR_HINT_TO_SUBJECT: Record<string, SubjectToneId> = {
  blue: 'math',
  pink: 'japanese',
  green: 'social',
  orange: 'science',
};

const DEFAULT_TONE: SubjectToneClasses = {
  iconBgClass: 'bg-slate-200 group-hover:bg-slate-300',
  stripClass: 'bg-slate-400',
  badgeClass: 'border-slate-300 bg-slate-100 text-slate-900',
  arrowClass: 'text-slate-500 group-hover:text-slate-700',
  focusRingClass: 'focus:ring-slate-500',
  cardClass: 'bg-white hover:bg-slate-50',
  progressClass: 'bg-slate-400',
  ctaClass: 'bg-slate-100 text-slate-900',
  ctaHoverClass: 'hover:bg-slate-200',
  accentTextClass: 'text-slate-700',
  accentSoftClass: 'bg-slate-100',
  correctClass: 'border-slate-500 bg-slate-100 text-slate-800',
};

export function resolveSubjectTone(subjectId: string | null | undefined, colorHint: string | null): SubjectToneClasses {
  if (subjectId) {
    if (subjectId in SUBJECT_TONE_BY_ID) {
      return SUBJECT_TONE_BY_ID[subjectId as SubjectToneId];
    }
  }

  if (colorHint && colorHint in COLOR_HINT_TO_SUBJECT) {
    return SUBJECT_TONE_BY_ID[COLOR_HINT_TO_SUBJECT[colorHint]];
  }

  return DEFAULT_TONE;
}
