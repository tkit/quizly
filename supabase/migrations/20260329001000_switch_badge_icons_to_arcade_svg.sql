UPDATE public.badge_definitions
SET icon_path = regexp_replace(
  regexp_replace(icon_path, '^/badges/64/', '/badges-arcade/svg/'),
  '\\.png$',
  '.svg'
)
WHERE icon_path LIKE '/badges/64/badge_%';
