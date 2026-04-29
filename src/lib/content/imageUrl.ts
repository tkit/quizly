const DEFAULT_QUESTION_IMAGE_BASE_URL = '';

function normalizePath(rawPath: string) {
  const trimmed = rawPath.trim();
  if (!trimmed) return null;
  if (trimmed.includes('://')) return null;

  const withoutLeadingSlash = trimmed.replace(/^\/+/, '');
  if (!withoutLeadingSlash || withoutLeadingSlash.includes('..')) {
    return null;
  }

  return withoutLeadingSlash;
}

function joinUrl(base: string, pathname: string) {
  const normalizedBase = base.replace(/\/+$/, '');
  const normalizedPath = pathname.replace(/^\/+/, '');
  return `${normalizedBase}/${normalizedPath}`;
}

export function buildQuestionImagePublicUrl(path: string, baseUrl = process.env.NEXT_PUBLIC_QUESTION_IMAGE_BASE_URL ?? DEFAULT_QUESTION_IMAGE_BASE_URL) {
  if (!baseUrl) {
    return null;
  }

  const normalizedPath = normalizePath(path);
  if (!normalizedPath) {
    return null;
  }

  const encodedPath = normalizedPath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');

  return joinUrl(baseUrl, encodedPath);
}

export function resolveQuestionImagePublicUrl(imagePath: string | null | undefined) {
  if (!imagePath) return null;
  return buildQuestionImagePublicUrl(imagePath);
}
