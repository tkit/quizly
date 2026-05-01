#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { readdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const databaseName = process.env.D1_DATABASE_NAME ?? 'quizly-staging';
const contentsDir = process.env.CONTENT_FIXTURE_DIR ?? 'contents';
const r2QuestionImagesBucket = process.env.R2_QUESTION_IMAGES_BUCKET ?? 'quizly-question-images-staging';

const parentGenres = [
  ['math', '算数', 'calculator', '計算や図形の基礎を学ぶ', 'blue'],
  ['japanese', '国語', 'book_open', 'ことばや文の読み書き', 'pink'],
  ['social', '社会', 'map', '地理や歴史の基礎を学ぶ', 'orange'],
  ['science', '理科', 'microscope', '自然や科学のしくみを学ぶ', 'green'],
].map(([id, name, icon_key, description, color_hint]) => ({
  id,
  name,
  parent_id: null,
  icon_key,
  description,
  color_hint,
}));

function hashRows(rows) {
  return createHash('sha256').update(JSON.stringify(rows)).digest('hex');
}

function stableQuestionId(row) {
  return createHash('sha256')
    .update(`${row.genre_id}::${row.question_text}`)
    .digest('hex')
    .slice(0, 32);
}

function normalizeQuestion(row, index, fileName) {
  const genre_id = String(row.genre_id ?? '').trim();
  const question_text = String(row.question_text ?? row.question ?? '').trim();
  const options = Array.isArray(row.options)
    ? row.options.map((choice) => String(choice))
    : Array.isArray(row.choices)
      ? row.choices.map((choice) => String(choice))
      : [];
  const answer = row.answer == null ? null : String(row.answer).trim();
  let correct_index = Number(row.correct_index);

  if (answer != null) {
    correct_index = options.findIndex((choice) => choice === answer);
  }

  if (!genre_id || !question_text || options.length < 2 || !Number.isInteger(correct_index) || correct_index < 0) {
    throw new Error(`Invalid question at ${fileName}#${index}`);
  }

  return {
    id: stableQuestionId({ genre_id, question_text }),
    genre_id,
    question_text,
    options,
    correct_index,
    explanation: String(row.explanation ?? '').trim(),
    image_url: row.image_url == null ? null : String(row.image_url).trim(),
    is_active: row.is_active == null ? 1 : Boolean(row.is_active) ? 1 : 0,
  };
}

async function loadExpectedContent() {
  const files = (await readdir(contentsDir)).filter((file) => file.endsWith('.json')).sort();
  const genreById = new Map(parentGenres.map((genre) => [genre.id, genre]));
  const questionById = new Map();

  for (const file of files) {
    const payload = JSON.parse(await readFile(join(contentsDir, file), 'utf8'));
    if (!payload || !Array.isArray(payload.genres) || !Array.isArray(payload.questions)) {
      continue;
    }

    for (const genre of payload.genres) {
      const id = String(genre.id ?? '').trim();
      if (!id) continue;
      genreById.set(id, {
        id,
        name: String(genre.name ?? '').trim(),
        parent_id: genre.parent_id == null ? null : String(genre.parent_id).trim(),
        icon_key: String(genre.icon_key ?? '').trim(),
        description: genre.description == null ? null : String(genre.description),
        color_hint: null,
      });
    }

    payload.questions.forEach((row, index) => {
      const question = normalizeQuestion(row, index, file);
      questionById.set(question.id, question);
    });
  }

  return {
    files,
    genres: [...genreById.values()].sort((a, b) => a.id.localeCompare(b.id)),
    questions: [...questionById.values()].sort((a, b) => a.id.localeCompare(b.id)),
  };
}

function runWrangler(args, options = {}) {
  const result = spawnSync('./node_modules/.bin/wrangler', args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    ...options,
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `wrangler failed: ${args.join(' ')}`);
  }

  return result.stdout;
}

function query(sql) {
  const stdout = runWrangler(['d1', 'execute', databaseName, '--remote', '--json', '--command', sql]);
  const payload = JSON.parse(stdout);
  if (!payload[0]?.success) {
    throw new Error(`D1 query failed: ${sql}`);
  }
  return payload[0].results;
}

function count(sql) {
  return Number(query(sql)[0]?.count ?? 0);
}

async function assertR2Objects(imageUrls) {
  if (imageUrls.length === 0) return;

  const tempDir = await mkdtemp(join(tmpdir(), 'quizly-r2-validate-'));
  try {
    for (const imageUrl of imageUrls) {
      runWrangler([
        'r2',
        'object',
        'get',
        `${r2QuestionImagesBucket}/${imageUrl}`,
        '--file',
        join(tempDir, imageUrl.replaceAll('/', '_')),
        '--remote',
      ]);
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

const expected = await loadExpectedContent();
const actualGenres = query(`
SELECT id, name, parent_id, icon_key, description, color_hint
FROM genres
ORDER BY id;
`);
const actualQuestions = query(`
SELECT id, genre_id, question_text, options, correct_index, explanation, image_url, is_active
FROM questions
ORDER BY id;
`).map((row) => ({
  ...row,
  options: JSON.parse(row.options),
  image_url: row.image_url ?? null,
  is_active: Number(row.is_active),
}));
const imageUrls = query(`
SELECT DISTINCT image_url
FROM questions
WHERE image_url IS NOT NULL AND image_url != ''
ORDER BY image_url;
`).map((row) => row.image_url);

const metrics = {
  database: databaseName,
  fixture_files: expected.files.length,
  expected_genres: expected.genres.length,
  actual_genres: actualGenres.length,
  expected_questions: expected.questions.length,
  actual_questions: actualQuestions.length,
  badge_definitions: count('SELECT COUNT(*) AS count FROM badge_definitions;'),
  invalid_genre_parents: count(`
SELECT COUNT(*) AS count
FROM genres child
LEFT JOIN genres parent ON child.parent_id = parent.id
WHERE child.parent_id IS NOT NULL AND parent.id IS NULL;
`),
  invalid_question_genres: count(`
SELECT COUNT(*) AS count
FROM questions q
LEFT JOIN genres g ON q.genre_id = g.id
WHERE g.id IS NULL;
`),
  media_references: imageUrls.length,
  expected_genres_hash: hashRows(expected.genres),
  actual_genres_hash: hashRows(actualGenres),
  expected_questions_hash: hashRows(expected.questions),
  actual_questions_hash: hashRows(actualQuestions),
};

await assertR2Objects(imageUrls);

console.log(JSON.stringify(metrics, null, 2));

const failures = [];
if (metrics.actual_genres !== metrics.expected_genres) failures.push('genre count mismatch');
if (metrics.actual_questions !== metrics.expected_questions) failures.push('question count mismatch');
if (metrics.badge_definitions !== 42) failures.push('badge definition count mismatch');
if (metrics.invalid_genre_parents !== 0) failures.push('invalid genre parent references');
if (metrics.invalid_question_genres !== 0) failures.push('invalid question genre references');
if (metrics.actual_genres_hash !== metrics.expected_genres_hash) failures.push('genre hash mismatch');
if (metrics.actual_questions_hash !== metrics.expected_questions_hash) failures.push('question hash mismatch');

if (failures.length > 0) {
  throw new Error(`Reference data validation failed: ${failures.join(', ')}`);
}
