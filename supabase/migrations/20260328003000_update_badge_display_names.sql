UPDATE public.badge_definitions
SET name = CASE key
  WHEN 'streak_days_l1' THEN '学習の芽'
  WHEN 'streak_days_l2' THEN '学習の若葉'
  WHEN 'streak_days_l3' THEN '小さな学習の木'
  WHEN 'streak_days_l4' THEN '大きな学習の木'
  WHEN 'streak_days_l5' THEN '花ひらく学習の木'

  WHEN 'perfect_sessions_l1' THEN 'ひらめきの火花'
  WHEN 'perfect_sessions_l2' THEN 'のびる小さな炎'
  WHEN 'perfect_sessions_l3' THEN 'つよい炎'
  WHEN 'perfect_sessions_l4' THEN 'かがやくかがり火'
  WHEN 'perfect_sessions_l5' THEN 'たいようチャレンジャー'

  WHEN 'genre_explorer_l1' THEN 'コンパスの一歩'
  WHEN 'genre_explorer_l2' THEN 'マップリーダー'
  WHEN 'genre_explorer_l3' THEN '双眼鏡スカウト'
  WHEN 'genre_explorer_l4' THEN 'テントトラベラー'
  WHEN 'genre_explorer_l5' THEN '地球儀エクスプローラー'

  WHEN 'subject_master_japanese_l1' THEN '国語スターター'
  WHEN 'subject_master_japanese_l2' THEN '国語チャレンジャー'
  WHEN 'subject_master_japanese_l3' THEN '国語スペシャリスト'
  WHEN 'subject_master_japanese_l4' THEN '国語エキスパート'
  WHEN 'subject_master_japanese_l5' THEN '国語マスター'

  WHEN 'subject_master_math_l1' THEN '算数スターター'
  WHEN 'subject_master_math_l2' THEN '算数チャレンジャー'
  WHEN 'subject_master_math_l3' THEN '算数スペシャリスト'
  WHEN 'subject_master_math_l4' THEN '算数エキスパート'
  WHEN 'subject_master_math_l5' THEN '算数マスター'

  WHEN 'subject_master_science_l1' THEN '理科スターター'
  WHEN 'subject_master_science_l2' THEN '理科チャレンジャー'
  WHEN 'subject_master_science_l3' THEN '理科スペシャリスト'
  WHEN 'subject_master_science_l4' THEN '理科エキスパート'
  WHEN 'subject_master_science_l5' THEN '理科マスター'

  WHEN 'subject_master_social_l1' THEN '社会スターター'
  WHEN 'subject_master_social_l2' THEN '社会チャレンジャー'
  WHEN 'subject_master_social_l3' THEN '社会スペシャリスト'
  WHEN 'subject_master_social_l4' THEN '社会エキスパート'
  WHEN 'subject_master_social_l5' THEN '社会マスター'

  WHEN 'secret_comeback' THEN 'おかえりチャレンジ'
  WHEN 'secret_perfect_recovery' THEN 'リベンジパーフェクト'
  ELSE name
END
WHERE key IN (
  'streak_days_l1', 'streak_days_l2', 'streak_days_l3', 'streak_days_l4', 'streak_days_l5',
  'perfect_sessions_l1', 'perfect_sessions_l2', 'perfect_sessions_l3', 'perfect_sessions_l4', 'perfect_sessions_l5',
  'genre_explorer_l1', 'genre_explorer_l2', 'genre_explorer_l3', 'genre_explorer_l4', 'genre_explorer_l5',
  'subject_master_japanese_l1', 'subject_master_japanese_l2', 'subject_master_japanese_l3', 'subject_master_japanese_l4', 'subject_master_japanese_l5',
  'subject_master_math_l1', 'subject_master_math_l2', 'subject_master_math_l3', 'subject_master_math_l4', 'subject_master_math_l5',
  'subject_master_science_l1', 'subject_master_science_l2', 'subject_master_science_l3', 'subject_master_science_l4', 'subject_master_science_l5',
  'subject_master_social_l1', 'subject_master_social_l2', 'subject_master_social_l3', 'subject_master_social_l4', 'subject_master_social_l5',
  'secret_comeback', 'secret_perfect_recovery'
);

UPDATE public.badge_definitions
SET condition_json = COALESCE(condition_json, '{}'::jsonb) || jsonb_build_object('type', 'comeback')
WHERE key = 'secret_comeback';

UPDATE public.badge_definitions
SET condition_json = COALESCE(condition_json, '{}'::jsonb) || jsonb_build_object('type', 'perfect_recovery')
WHERE key = 'secret_perfect_recovery';
