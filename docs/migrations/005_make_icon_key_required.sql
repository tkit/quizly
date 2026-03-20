BEGIN;

-- Backfill any remaining NULL icon_key rows before enforcing NOT NULL.
-- This handles rows created before icon_key adoption or values not covered in 004.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'genres'
      AND column_name = 'icon'
  ) THEN
    UPDATE public.genres
    SET icon_key = CASE
      WHEN icon = '➕' THEN 'calculator'
      WHEN icon = '📖' THEN 'book_open'
      WHEN icon = '📘' THEN 'book_marked'
      WHEN icon = '📚' THEN 'book_open'
      WHEN icon = '🗺️' THEN 'map'
      WHEN icon = '🏯' THEN 'landmark'
      WHEN icon = '📜' THEN 'landmark'
      WHEN icon = '🔬' THEN 'microscope'
      WHEN icon = '🧪' THEN 'flask'
      WHEN icon = '🧮' THEN 'calculator'
      WHEN icon = '📝' THEN 'notebook'
      WHEN icon = '💬' THEN 'message'
      WHEN icon = '⏰' THEN 'clock'
      ELSE COALESCE(icon_key, 'book_open')
    END
    WHERE icon_key IS NULL;
  ELSE
    UPDATE public.genres
    SET icon_key = 'book_open'
    WHERE icon_key IS NULL;
  END IF;
END $$;

ALTER TABLE public.genres
  ALTER COLUMN icon_key SET NOT NULL;

ALTER TABLE public.genres
  DROP COLUMN IF EXISTS icon;

ALTER TABLE public.genres
  DROP CONSTRAINT IF EXISTS genres_icon_key_allowed;

ALTER TABLE public.genres
  ADD CONSTRAINT genres_icon_key_allowed CHECK (
    icon_key IN (
      'calculator',
      'book_open',
      'book_marked',
      'map',
      'landmark',
      'microscope',
      'flask',
      'notebook',
      'message',
      'clock'
    )
  );

COMMIT;
