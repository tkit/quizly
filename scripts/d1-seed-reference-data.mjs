#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const args = new Set(process.argv.slice(2));
const isDryRun = args.has('--dry-run');
const databaseName = process.env.D1_DATABASE_NAME ?? 'quizly-staging';
const wranglerEnv = process.env.WRANGLER_ENV ?? 'staging';
const contentsDir = process.env.CONTENT_FIXTURE_DIR ?? 'contents';

const parentGenres = [
  {
    id: 'math',
    name: '算数',
    parent_id: null,
    icon_key: 'calculator',
    description: '計算や図形の基礎を学ぶ',
    color_hint: 'blue',
  },
  {
    id: 'japanese',
    name: '国語',
    parent_id: null,
    icon_key: 'book_open',
    description: 'ことばや文の読み書き',
    color_hint: 'pink',
  },
  {
    id: 'social',
    name: '社会',
    parent_id: null,
    icon_key: 'map',
    description: '地理や歴史の基礎を学ぶ',
    color_hint: 'orange',
  },
  {
    id: 'science',
    name: '理科',
    parent_id: null,
    icon_key: 'microscope',
    description: '自然や科学のしくみを学ぶ',
    color_hint: 'green',
  },
];

const badgeDefinitions = [
  ...[
    ['streak_days_l1', 'streak_days', 1, '学習の芽', 'badge_streak_days_l1', false, { threshold: 3 }, 10],
    ['streak_days_l2', 'streak_days', 2, '学習の若葉', 'badge_streak_days_l2', false, { threshold: 7 }, 20],
    ['streak_days_l3', 'streak_days', 3, '小さな学習の木', 'badge_streak_days_l3', false, { threshold: 14 }, 30],
    ['streak_days_l4', 'streak_days', 4, '大きな学習の木', 'badge_streak_days_l4', false, { threshold: 21 }, 40],
    ['streak_days_l5', 'streak_days', 5, '花ひらく学習の木', 'badge_streak_days_l5', false, { threshold: 30 }, 50],
    ['perfect_sessions_l1', 'perfect_sessions', 1, 'ひらめきの火花', 'badge_perfect_sessions_l1', false, { threshold: 1 }, 110],
    ['perfect_sessions_l2', 'perfect_sessions', 2, 'のびる小さな炎', 'badge_perfect_sessions_l2', false, { threshold: 3 }, 120],
    ['perfect_sessions_l3', 'perfect_sessions', 3, 'つよい炎', 'badge_perfect_sessions_l3', false, { threshold: 5 }, 130],
    ['perfect_sessions_l4', 'perfect_sessions', 4, 'かがやくかがり火', 'badge_perfect_sessions_l4', false, { threshold: 10 }, 140],
    ['perfect_sessions_l5', 'perfect_sessions', 5, 'たいようチャレンジャー', 'badge_perfect_sessions_l5', false, { threshold: 20 }, 150],
    ['genre_explorer_l1', 'genre_explorer', 1, 'コンパスの一歩', 'badge_genre_explorer_l1', false, { threshold: 2 }, 210],
    ['genre_explorer_l2', 'genre_explorer', 2, 'マップリーダー', 'badge_genre_explorer_l2', false, { threshold: 4 }, 220],
    ['genre_explorer_l3', 'genre_explorer', 3, '双眼鏡スカウト', 'badge_genre_explorer_l3', false, { threshold: 12 }, 230],
    ['genre_explorer_l4', 'genre_explorer', 4, 'テントトラベラー', 'badge_genre_explorer_l4', false, { threshold: 22 }, 240],
    ['genre_explorer_l5', 'genre_explorer', 5, '地球儀エクスプローラー', 'badge_genre_explorer_l5', false, { threshold: 36 }, 250],
    ['total_points_l1', 'total_points', 1, 'ポイントの種', 'badge_total_points_l1', false, { threshold: 100 }, 260],
    ['total_points_l2', 'total_points', 2, 'ポイントの芽', 'badge_total_points_l2', false, { threshold: 500 }, 270],
    ['total_points_l3', 'total_points', 3, 'ポイントの若木', 'badge_total_points_l3', false, { threshold: 1500 }, 280],
    ['total_points_l4', 'total_points', 4, 'ポイントの大樹', 'badge_total_points_l4', false, { threshold: 5000 }, 290],
    ['total_points_l5', 'total_points', 5, 'ポイントの銀河', 'badge_total_points_l5', false, { threshold: 10000 }, 300],
  ],
  ...['japanese', 'math', 'science', 'social'].flatMap((subjectId) => {
    const label = { japanese: '国語', math: '算数', science: '理科', social: '社会' }[subjectId];
    const names = ['スターター', 'チャレンジャー', 'スペシャリスト', 'エキスパート', 'マスター'];
    return [3, 7, 14, 21, 30].map((threshold, index) => [
      `subject_master_${subjectId}_l${index + 1}`,
      'subject_master',
      index + 1,
      `${label}${names[index]}`,
      `badge_subject_master_${subjectId}_l${index + 1}`,
      false,
      { subject_id: subjectId, threshold },
      310 + ['japanese', 'math', 'science', 'social'].indexOf(subjectId) * 50 + index * 10,
    ]);
  }),
  ['secret_comeback', 'secret', null, 'おかえりチャレンジ', 'badge_secret_comeback', true, { type: 'comeback' }, 910],
  [
    'secret_perfect_recovery',
    'secret',
    null,
    'リベンジパーフェクト',
    'badge_secret_perfect_recovery',
    true,
    { type: 'perfect_recovery' },
    920,
  ],
].map(([key, family, level, name, iconName, isSecret, condition, sortOrder]) => ({
  key,
  family,
  level,
  name,
  icon_path: `/badges-arcade/svg/${iconName}.svg`,
  is_secret: isSecret,
  condition_json: condition,
  sort_order: sortOrder,
}));

function sqlString(value) {
  if (value == null) return 'NULL';
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sqlJson(value) {
  return sqlString(JSON.stringify(value));
}

function stableQuestionId(row) {
  return createHash('sha256')
    .update(`${row.genre_id}::${row.question_text}`)
    .digest('hex')
    .slice(0, 32);
}

function normalizeQuestion(row, index, fileName) {
  const genreId = String(row.genre_id ?? '').trim();
  const questionText = String(row.question_text ?? row.question ?? '').trim();
  const options = Array.isArray(row.options)
    ? row.options.map((choice) => String(choice))
    : Array.isArray(row.choices)
      ? row.choices.map((choice) => String(choice))
      : [];
  const answer = row.answer == null ? null : String(row.answer).trim();
  let correctIndex = Number(row.correct_index);

  if (answer != null) {
    correctIndex = options.findIndex((choice) => choice === answer);
  }

  if (!genreId || !questionText || options.length < 2 || !Number.isInteger(correctIndex) || correctIndex < 0) {
    throw new Error(`Invalid question at ${fileName}#${index}`);
  }

  return {
    id: stableQuestionId({ genre_id: genreId, question_text: questionText }),
    genre_id: genreId,
    question_text: questionText,
    options,
    correct_index: correctIndex,
    explanation: String(row.explanation ?? '').trim(),
    image_url: row.image_url == null ? null : String(row.image_url).trim(),
    is_active: row.is_active == null ? true : Boolean(row.is_active),
  };
}

async function loadContentFixtures() {
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
    genres: [...genreById.values()],
    questions: [...questionById.values()],
  };
}

function buildSql({ genres, questions }) {
  const statements = ['PRAGMA foreign_keys = ON;'];

  for (const genre of genres.filter((row) => row.parent_id == null)) {
    statements.push(genreUpsertSql(genre));
  }
  for (const genre of genres.filter((row) => row.parent_id != null)) {
    statements.push(genreUpsertSql(genre));
  }

  for (const question of questions) {
    statements.push(`
INSERT INTO questions (
  id, genre_id, question_text, options, correct_index, explanation, image_url, is_active
) VALUES (
  ${sqlString(question.id)},
  ${sqlString(question.genre_id)},
  ${sqlString(question.question_text)},
  ${sqlJson(question.options)},
  ${question.correct_index},
  ${sqlString(question.explanation)},
  ${sqlString(question.image_url)},
  ${question.is_active ? 1 : 0}
)
ON CONFLICT(id) DO UPDATE SET
  genre_id = excluded.genre_id,
  question_text = excluded.question_text,
  options = excluded.options,
  correct_index = excluded.correct_index,
  explanation = excluded.explanation,
  image_url = excluded.image_url,
  is_active = excluded.is_active;`);
  }

  for (const badge of badgeDefinitions) {
    statements.push(`
INSERT INTO badge_definitions (
  key, family, level, name, icon_path, is_secret, condition_json, is_active, sort_order
) VALUES (
  ${sqlString(badge.key)},
  ${sqlString(badge.family)},
  ${badge.level == null ? 'NULL' : badge.level},
  ${sqlString(badge.name)},
  ${sqlString(badge.icon_path)},
  ${badge.is_secret ? 1 : 0},
  ${sqlJson(badge.condition_json)},
  1,
  ${badge.sort_order}
)
ON CONFLICT(key) DO UPDATE SET
  family = excluded.family,
  level = excluded.level,
  name = excluded.name,
  icon_path = excluded.icon_path,
  is_secret = excluded.is_secret,
  condition_json = excluded.condition_json,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order;`);
  }

  return `${statements.join('\n')}\n`;
}

function genreUpsertSql(genre) {
  return `
INSERT INTO genres (
  id, name, parent_id, icon_key, description, color_hint
) VALUES (
  ${sqlString(genre.id)},
  ${sqlString(genre.name)},
  ${sqlString(genre.parent_id)},
  ${sqlString(genre.icon_key)},
  ${sqlString(genre.description)},
  ${sqlString(genre.color_hint)}
)
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  parent_id = excluded.parent_id,
  icon_key = excluded.icon_key,
  description = excluded.description,
  color_hint = excluded.color_hint;`;
}

const content = await loadContentFixtures();
const sql = buildSql(content);
console.log(`[d1-seed-reference-data] genres=${content.genres.length}`);
console.log(`[d1-seed-reference-data] questions=${content.questions.length}`);
console.log(`[d1-seed-reference-data] badge_definitions=${badgeDefinitions.length}`);

if (isDryRun) {
  console.log(sql);
  process.exit(0);
}

const tempDir = await mkdtemp(join(tmpdir(), 'quizly-d1-seed-'));
const sqlPath = join(tempDir, 'reference-data.sql');

try {
  await writeFile(sqlPath, sql, 'utf8');
  const result = spawnSync(
    'npx',
    ['wrangler', 'd1', 'execute', databaseName, '--env', wranglerEnv, '--remote', '--file', sqlPath],
    { stdio: 'inherit' },
  );

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
