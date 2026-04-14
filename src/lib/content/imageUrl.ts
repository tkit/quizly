const DEFAULT_QUESTION_IMAGE_BUCKET = 'quiz-images';

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

export function buildSupabaseStoragePublicUrl(path: string, bucket = DEFAULT_QUESTION_IMAGE_BUCKET) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
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

  return joinUrl(supabaseUrl, `/storage/v1/object/public/${bucket}/${encodedPath}`);
}

export function resolveQuestionImagePublicUrl(imagePath: string | null | undefined) {
  if (!imagePath) return null;
  const bucket = process.env.NEXT_PUBLIC_QUESTION_IMAGE_BUCKET || DEFAULT_QUESTION_IMAGE_BUCKET;
  return buildSupabaseStoragePublicUrl(imagePath, bucket);
}
