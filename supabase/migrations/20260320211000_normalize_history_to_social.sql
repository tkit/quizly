BEGIN;

-- 1) Ensure canonical "social" parent exists, cloning from "history" only when needed.
INSERT INTO public.genres (id, name, parent_id, icon_key, description, color_hint)
SELECT
  'social',
  '社会',
  NULL,
  g.icon_key,
  COALESCE(g.description, '地理や歴史の基礎を学ぶ'),
  'green'
FROM public.genres g
WHERE g.id = 'history'
  AND NOT EXISTS (
    SELECT 1 FROM public.genres existing WHERE existing.id = 'social'
  );

-- 2) Ensure "social-basic" exists when "history-basic" is present.
INSERT INTO public.genres (id, name, parent_id, icon_key, description, color_hint)
SELECT
  'social-basic',
  '社会の基礎問題',
  'social',
  g.icon_key,
  COALESCE(g.description, '社会の基礎問題に取り組む'),
  'green'
FROM public.genres g
WHERE g.id = 'history-basic'
  AND NOT EXISTS (
    SELECT 1 FROM public.genres existing WHERE existing.id = 'social-basic'
  );

-- 3) Re-parent any children under "history" to "social".
UPDATE public.genres
SET parent_id = 'social'
WHERE parent_id = 'history';

-- 4) Move foreign-key references from history IDs to social IDs.
UPDATE public.questions
SET genre_id = 'social'
WHERE genre_id = 'history';

UPDATE public.study_sessions
SET genre_id = 'social'
WHERE genre_id = 'history';

UPDATE public.questions
SET genre_id = CASE
  WHEN EXISTS (SELECT 1 FROM public.genres g WHERE g.id = 'social-basic') THEN 'social-basic'
  ELSE 'social'
END
WHERE genre_id = 'history-basic';

UPDATE public.study_sessions
SET genre_id = CASE
  WHEN EXISTS (SELECT 1 FROM public.genres g WHERE g.id = 'social-basic') THEN 'social-basic'
  ELSE 'social'
END
WHERE genre_id = 'history-basic';

-- 5) Remove deprecated IDs.
DELETE FROM public.genres WHERE id = 'history-basic';
DELETE FROM public.genres WHERE id = 'history';

-- 6) Normalize canonical subject rows and color hints.
UPDATE public.genres
SET
  name = '社会',
  parent_id = NULL,
  description = '地理や歴史の基礎を学ぶ',
  color_hint = 'green'
WHERE id = 'social';

UPDATE public.genres
SET color_hint = 'orange'
WHERE id = 'science';

UPDATE public.genres
SET
  parent_id = 'social',
  color_hint = 'green'
WHERE id = 'social-basic';

COMMIT;
