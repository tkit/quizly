UPDATE public.badge_definitions
SET condition_json = jsonb_build_object('threshold', 12)
WHERE key = 'genre_explorer_l3';

UPDATE public.badge_definitions
SET condition_json = jsonb_build_object('threshold', 22)
WHERE key = 'genre_explorer_l4';

UPDATE public.badge_definitions
SET condition_json = jsonb_build_object('threshold', 36)
WHERE key = 'genre_explorer_l5';
