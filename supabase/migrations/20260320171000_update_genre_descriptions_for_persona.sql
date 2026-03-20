BEGIN;

-- Align genre descriptions to the "middle grade and above" persona tone.
UPDATE public.genres
SET description = CASE id
  WHEN 'math' THEN '計算や図形の基礎を学ぶ'
  WHEN 'social' THEN '地理や歴史の基礎を学ぶ'
  WHEN 'science' THEN '自然や科学のしくみを学ぶ'
  WHEN 'math-basic-calc' THEN '四則計算の基礎を身につける'
  WHEN 'math-time' THEN '時刻の読み取りと時間計算を学ぶ'
  WHEN 'history' THEN '過去の出来事や人物を学ぶ'
  WHEN 'math-basic' THEN '算数の基礎問題に取り組む'
  WHEN 'history-basic' THEN '歴史の基礎問題に取り組む'
  WHEN 'science-basic' THEN '理科の基礎問題に取り組む'
  ELSE description
END
WHERE id IN (
  'math',
  'social',
  'science',
  'math-basic-calc',
  'math-time',
  'history',
  'math-basic',
  'history-basic',
  'science-basic'
);

COMMIT;
