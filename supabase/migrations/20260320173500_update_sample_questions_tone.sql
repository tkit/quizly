BEGIN;

-- Align seeded sample questions/explanations to the "middle grade and above" tone.
UPDATE public.questions
SET
  question_text = CASE
    WHEN question_text = '15 + 27 はいくつでしょう？' THEN '15 + 27 はいくつですか？'
    WHEN question_text = '1日は何時間でしょう？' THEN '1日は何時間ですか？'
    ELSE question_text
  END,
  explanation = CASE
    WHEN question_text = '15 + 27 はいくつでしょう？' THEN '1の位は 5+7=12 です。2を残して1を十の位に繰り上げると、十の位は 1+2+1=4 なので、答えは42です。'
    WHEN question_text = '1日は何時間でしょう？' THEN '1日は24時間です。'
    WHEN question_text = '「山道」を読むとき、正しいのはどれ？' THEN '和語として読む場合は「やまみち」が正解です。'
    WHEN question_text = '「あしをひっぱる」の意味として正しいのはどれ？' THEN '慣用句「あしをひっぱる」は、じゃまをするという意味です。'
    ELSE explanation
  END
WHERE question_text IN (
  '15 + 27 はいくつでしょう？',
  '1日は何時間でしょう？',
  '「山道」を読むとき、正しいのはどれ？',
  '「あしをひっぱる」の意味として正しいのはどれ？'
);

COMMIT;
