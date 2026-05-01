export type QuizQuestionRow = {
  id: string;
  genre_id: string;
  question_text: string;
  options: string[];
  correct_index: number;
  explanation: string | null;
  image_url: string | null;
};

function buildStableQuestionOrderKey(childId: string, genreId: string, questionId: string) {
  const source = `${childId}:${genreId}:${questionId}`;
  let hash = 0;

  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) >>> 0;
  }

  return hash;
}

export async function getD1QuizQuestionSet(
  db: D1Database,
  params: {
    childId: string;
    genreId: string;
    requestedCount: number | null;
  },
) {
  const { childId, genreId, requestedCount } = params;
  const count = requestedCount && requestedCount > 0 ? requestedCount : 0;

  const result = await db
    .prepare(
      `
      SELECT id, genre_id, question_text, options, correct_index, explanation, image_url
      FROM questions
      WHERE genre_id = ? AND is_active = 1
    `,
    )
    .bind(genreId)
    .all<Omit<QuizQuestionRow, 'options'> & { options: string }>();

  const allQuestions = (result.results ?? []).map((row) => ({
    ...row,
    options: JSON.parse(row.options) as string[],
  }));
  const resolvedCount = count > 0 ? Math.min(count, allQuestions.length) : allQuestions.length;
  const selected = [...allQuestions]
    .sort(
      (left, right) =>
        buildStableQuestionOrderKey(childId, genreId, left.id) -
        buildStableQuestionOrderKey(childId, genreId, right.id),
    )
    .slice(0, resolvedCount);

  return selected;
}
