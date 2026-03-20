export type SubjectToneId = 'math' | 'japanese' | 'social' | 'science';

type SubjectToneClasses = {
  iconBgClass: string;
  stripClass: string;
  badgeClass: string;
  arrowClass: string;
  focusRingClass: string;
};

const SUBJECT_TONE_BY_ID: Record<SubjectToneId, SubjectToneClasses> = {
  japanese: {
    iconBgClass: 'bg-rose-200 group-hover:bg-rose-300',
    stripClass: 'bg-rose-400',
    badgeClass: 'border-rose-300 bg-rose-50 text-rose-900',
    arrowClass: 'text-rose-400 group-hover:text-rose-600',
    focusRingClass: 'focus:ring-rose-500',
  },
  math: {
    iconBgClass: 'bg-blue-200 group-hover:bg-blue-300',
    stripClass: 'bg-blue-400',
    badgeClass: 'border-blue-300 bg-blue-50 text-blue-900',
    arrowClass: 'text-blue-400 group-hover:text-blue-600',
    focusRingClass: 'focus:ring-blue-500',
  },
  social: {
    iconBgClass: 'bg-green-200 group-hover:bg-green-300',
    stripClass: 'bg-green-400',
    badgeClass: 'border-green-300 bg-green-50 text-green-900',
    arrowClass: 'text-green-400 group-hover:text-green-600',
    focusRingClass: 'focus:ring-green-500',
  },
  science: {
    iconBgClass: 'bg-orange-200 group-hover:bg-orange-300',
    stripClass: 'bg-orange-400',
    badgeClass: 'border-orange-300 bg-orange-50 text-orange-900',
    arrowClass: 'text-orange-400 group-hover:text-orange-600',
    focusRingClass: 'focus:ring-orange-500',
  },
};

const COLOR_HINT_TO_SUBJECT: Record<string, SubjectToneId> = {
  blue: 'math',
  pink: 'japanese',
  green: 'social',
  orange: 'science',
};

const DEFAULT_TONE: SubjectToneClasses = {
  iconBgClass: 'bg-teal-200 group-hover:bg-teal-300',
  stripClass: 'bg-teal-400',
  badgeClass: 'border-teal-300 bg-teal-50 text-teal-900',
  arrowClass: 'text-teal-400 group-hover:text-teal-600',
  focusRingClass: 'focus:ring-teal-500',
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
