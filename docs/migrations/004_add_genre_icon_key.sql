ALTER TABLE public.genres
ADD COLUMN IF NOT EXISTS icon_key text;

UPDATE public.genres
SET icon_key = CASE
  WHEN icon = '➕' THEN 'calculator'
  WHEN icon = '📖' THEN 'book_open'
  WHEN icon = '📘' THEN 'book_marked'
  WHEN icon = '📚' THEN 'book_open'
  WHEN icon = '🗺️' THEN 'map'
  WHEN icon = '🏯' THEN 'landmark'
  WHEN icon = '🔬' THEN 'microscope'
  WHEN icon = '🧪' THEN 'flask'
  WHEN icon = '🧮' THEN 'calculator'
  WHEN icon = '📝' THEN 'notebook'
  WHEN icon = '💬' THEN 'message'
  WHEN icon = '⏰' THEN 'clock'
  ELSE icon_key
END
WHERE icon_key IS NULL;
