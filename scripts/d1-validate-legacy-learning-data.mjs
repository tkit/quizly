#!/usr/bin/env node
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const databaseName = process.env.D1_DATABASE_NAME ?? 'quizly';
const legacyExportDir = process.env.LEGACY_EXPORT_DIR ?? '.legacy-supabase-export';

const tables = [
  'guardian_accounts',
  'child_profiles',
  'study_sessions',
  'study_history',
  'point_transactions',
  'child_streak_state',
  'child_learning_stats',
  'child_genre_progress',
  'child_subject_stats',
  'child_badges',
  'badge_unlock_events',
];

async function expectedCount(table) {
  const path = join(legacyExportDir, `${table}.json`);
  if (!existsSync(path)) return 0;
  const payload = JSON.parse(await readFile(path, 'utf8'));
  if (!Array.isArray(payload)) throw new Error(`${path} must contain a JSON array`);
  return payload.length;
}

function query(sql) {
  const result = spawnSync(
    './node_modules/.bin/wrangler',
    ['d1', 'execute', databaseName, '--remote', '--json', '--command', sql],
    { encoding: 'utf8' },
  );

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `D1 query failed: ${sql}`);
  }

  const payload = JSON.parse(result.stdout);
  if (!payload[0]?.success) {
    throw new Error(`D1 query failed: ${sql}`);
  }
  return payload[0].results;
}

function count(sql) {
  return Number(query(sql)[0]?.count ?? 0);
}

const files = (await readdir(legacyExportDir).catch(() => [])).filter((file) => file.endsWith('.json')).sort();
const tableMetrics = [];

for (const table of tables) {
  const expected = await expectedCount(table);
  const actual = count(`SELECT COUNT(*) AS count FROM ${table};`);
  tableMetrics.push({ table, expected, actual, ok: actual >= expected });
}

const checks = {
  files,
  table_metrics: tableMetrics,
  invalid_child_guardians: count(`
SELECT COUNT(*) AS count
FROM child_profiles cp
LEFT JOIN guardian_accounts ga ON ga.id = cp.guardian_id
WHERE ga.id IS NULL;
`),
  invalid_session_children: count(`
SELECT COUNT(*) AS count
FROM study_sessions ss
LEFT JOIN child_profiles cp ON cp.id = ss.child_id
WHERE cp.id IS NULL;
`),
  invalid_history_sessions: count(`
SELECT COUNT(*) AS count
FROM study_history sh
LEFT JOIN study_sessions ss ON ss.id = sh.session_id
WHERE ss.id IS NULL;
`),
  invalid_history_children: count(`
SELECT COUNT(*) AS count
FROM study_history sh
LEFT JOIN child_profiles cp ON cp.id = sh.child_id
WHERE cp.id IS NULL;
`),
  invalid_history_questions: count(`
SELECT COUNT(*) AS count
FROM study_history sh
LEFT JOIN questions q ON q.id = sh.question_id
WHERE q.id IS NULL;
`),
  children_without_guardian: count(`
SELECT COUNT(*) AS count
FROM child_profiles
WHERE guardian_id IS NULL OR guardian_id = '';
`),
};

console.log(JSON.stringify(checks, null, 2));

const failures = [
  ...tableMetrics.filter((metric) => !metric.ok).map((metric) => `${metric.table} count ${metric.actual} < ${metric.expected}`),
  ...Object.entries(checks)
    .filter(([key, value]) => key.startsWith('invalid_') && Number(value) !== 0)
    .map(([key, value]) => `${key}=${value}`),
  checks.children_without_guardian !== 0 ? `children_without_guardian=${checks.children_without_guardian}` : null,
].filter(Boolean);

if (failures.length > 0) {
  throw new Error(`Legacy learning data validation failed: ${failures.join(', ')}`);
}
