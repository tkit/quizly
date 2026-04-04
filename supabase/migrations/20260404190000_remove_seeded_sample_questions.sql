BEGIN;

-- Deactivate legacy seeded sample questions so quiz content is managed only via content:sync.
-- Use soft delete (is_active=false) to avoid breaking foreign-key references from study_history.
UPDATE public.questions
SET is_active = false
WHERE (genre_id, question_text) IN (
  ('math-basic-calc', '15 + 27 はいくつですか？'),
  ('math-basic-calc', '15 + 27 はいくつでしょう？'),
  ('math-time', '1日は何時間ですか？'),
  ('math-time', '1日は何時間でしょう？'),
  ('jp-grammar-01', '「山道」を読むとき、正しいのはどれ？'),
  ('jp-grammar-02', '「あしをひっぱる」の意味として正しいのはどれ？')
);

COMMIT;
