#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const args = new Set(process.argv.slice(2));
const isDryRun = args.has('--dry-run');
const databaseName = process.env.D1_DATABASE_NAME ?? 'quizly';
const wranglerEnv = process.env.WRANGLER_ENV ?? '';
const legacyExportDir = process.env.LEGACY_EXPORT_DIR ?? '.legacy-supabase-export';
const guardianMapFile = process.env.LEGACY_GUARDIAN_MAP_FILE;
const questionMapFile = process.env.LEGACY_QUESTION_MAP_FILE;
const wranglerEnvArgs = wranglerEnv ? ['--env', wranglerEnv] : [];

const orderedTables = [
  'guardian_accounts',
  'child_profiles',
  'study_sessions',
  'study_history',
  'point_transactions',
  'child_streak_state',
  'child_daily_point_state',
  'child_learning_stats',
  'child_genre_progress',
  'child_subject_stats',
  'child_badges',
  'badge_unlock_events',
  'parent_reauth_challenges',
];

const tableColumns = {
  guardian_accounts: ['id', 'email', 'display_name', 'parent_pin_hash', 'created_at', 'updated_at'],
  child_profiles: [
    'id',
    'guardian_id',
    'display_name',
    'avatar_url',
    'pin_hash',
    'auth_mode',
    'total_points',
    'created_at',
    'updated_at',
  ],
  study_sessions: [
    'id',
    'child_id',
    'genre_id',
    'mode',
    'total_questions',
    'correct_count',
    'earned_points',
    'started_at',
    'completed_at',
  ],
  study_history: ['id', 'session_id', 'child_id', 'question_id', 'is_correct', 'selected_index', 'answered_at'],
  point_transactions: ['id', 'child_id', 'session_id', 'points', 'reason', 'created_at'],
  child_streak_state: [
    'child_id',
    'current_streak_days',
    'longest_streak_days',
    'last_studied_date',
    'weekly_shield_count',
    'shield_week_key',
    'created_at',
    'updated_at',
  ],
  child_daily_point_state: [
    'child_id',
    'state_date',
    'consecutive_correct_count',
    'streak_bonus_count',
    'daily_challenge_awarded',
    'created_at',
    'updated_at',
  ],
  child_learning_stats: ['child_id', 'perfect_session_count', 'genre_explorer_count', 'updated_at'],
  child_genre_progress: ['child_id', 'genre_id', 'first_session_id', 'first_completed_at', 'created_at'],
  child_subject_stats: ['child_id', 'subject_id', 'session_count', 'updated_at'],
  child_badges: ['id', 'child_id', 'badge_key', 'unlocked_at', 'session_id', 'latest_progress', 'created_at'],
  badge_unlock_events: ['id', 'child_id', 'badge_key', 'session_id', 'created_at'],
  parent_reauth_challenges: ['id', 'guardian_id', 'verified_at', 'expires_at', 'created_at'],
};

const conflictTargets = {
  guardian_accounts: ['id'],
  child_profiles: ['id'],
  study_sessions: ['id'],
  study_history: ['id'],
  point_transactions: ['id'],
  child_streak_state: ['child_id'],
  child_daily_point_state: ['child_id'],
  child_learning_stats: ['child_id'],
  child_genre_progress: ['child_id', 'genre_id'],
  child_subject_stats: ['child_id', 'subject_id'],
  child_badges: ['child_id', 'badge_key'],
  badge_unlock_events: ['id'],
  parent_reauth_challenges: ['id'],
};

const numericColumns = new Set([
  'total_points',
  'total_questions',
  'correct_count',
  'earned_points',
  'is_correct',
  'selected_index',
  'points',
  'current_streak_days',
  'longest_streak_days',
  'weekly_shield_count',
  'consecutive_correct_count',
  'streak_bonus_count',
  'daily_challenge_awarded',
  'perfect_session_count',
  'genre_explorer_count',
  'session_count',
  'latest_progress',
]);

const booleanColumns = new Set(['is_correct', 'daily_challenge_awarded']);

function sqlString(value) {
  if (value == null) return 'NULL';
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sqlValue(column, value) {
  if (value == null || value === '') return 'NULL';
  if (booleanColumns.has(column)) return value === true || value === 1 || value === '1' ? '1' : '0';
  if (numericColumns.has(column)) return String(Number(value));
  return sqlString(value);
}

function stableQuestionId(row) {
  return createHash('sha256')
    .update(`${row.genre_id}::${row.question_text}`)
    .digest('hex')
    .slice(0, 32);
}

async function readJsonIfExists(fileName) {
  const path = join(legacyExportDir, fileName);
  if (!existsSync(path)) return [];
  const payload = JSON.parse(await readFile(path, 'utf8'));
  if (!Array.isArray(payload)) {
    throw new Error(`${path} must contain a JSON array`);
  }
  return payload;
}

async function readMapFile(path) {
  if (!path) return new Map();
  const payload = JSON.parse(await readFile(path, 'utf8'));
  if (Array.isArray(payload)) {
    return new Map(payload.map((row) => [String(row.from ?? row.legacy_id ?? row.old_id), String(row.to ?? row.d1_id ?? row.new_id)]));
  }
  return new Map(Object.entries(payload).map(([key, value]) => [String(key), String(value)]));
}

async function buildQuestionMap() {
  const explicitMap = await readMapFile(questionMapFile);
  const legacyQuestions = await readJsonIfExists('questions.json');
  const derivedEntries = legacyQuestions
    .filter((row) => row.id != null && row.genre_id != null && (row.question_text != null || row.question != null))
    .map((row) => [
      String(row.id),
      stableQuestionId({
        genre_id: String(row.genre_id).trim(),
        question_text: String(row.question_text ?? row.question).trim(),
      }),
    ]);

  return new Map([...derivedEntries, ...explicitMap]);
}

function mapValue(value, map) {
  if (value == null) return value;
  return map.get(String(value)) ?? value;
}

function normalizeRow(table, row, maps) {
  const next = { ...row };
  const now = new Date().toISOString();

  if (table === 'guardian_accounts') {
    next.id = mapValue(next.id ?? next.user_id ?? next.auth_user_id, maps.guardians);
    next.email = next.email ?? null;
    next.display_name = next.display_name ?? next.name ?? next.email?.split('@')[0] ?? '保護者';
    next.created_at = next.created_at ?? now;
    next.updated_at = next.updated_at ?? next.created_at ?? now;
  }

  if (table === 'child_profiles') {
    next.guardian_id = mapValue(next.guardian_id ?? next.user_id ?? next.owner_id, maps.guardians);
    next.display_name = next.display_name ?? next.name;
    next.auth_mode = next.auth_mode ?? 'none';
    next.total_points = next.total_points ?? 0;
    next.created_at = next.created_at ?? now;
    next.updated_at = next.updated_at ?? next.created_at ?? now;
  }

  if (table === 'study_sessions') {
    next.mode = next.mode ?? 'normal';
    next.total_questions = next.total_questions ?? next.question_count ?? 0;
    next.correct_count = next.correct_count ?? 0;
    next.earned_points = next.earned_points ?? 0;
    next.started_at = next.started_at ?? next.created_at ?? next.completed_at ?? now;
  }

  if (table === 'study_history') {
    next.question_id = mapValue(next.question_id, maps.questions);
    next.is_correct = next.is_correct ?? false;
    next.selected_index = next.selected_index ?? 0;
    next.answered_at = next.answered_at ?? next.created_at ?? now;
  }

  if (table === 'point_transactions') {
    next.reason = next.reason ?? 'legacy_import';
    next.created_at = next.created_at ?? now;
  }

  if (table === 'child_streak_state') {
    next.current_streak_days = next.current_streak_days ?? 0;
    next.longest_streak_days = next.longest_streak_days ?? 0;
    next.weekly_shield_count = next.weekly_shield_count ?? 1;
    next.created_at = next.created_at ?? now;
    next.updated_at = next.updated_at ?? now;
  }

  if (table === 'child_daily_point_state') {
    next.consecutive_correct_count = next.consecutive_correct_count ?? 0;
    next.streak_bonus_count = next.streak_bonus_count ?? 0;
    next.daily_challenge_awarded = next.daily_challenge_awarded ?? 0;
    next.created_at = next.created_at ?? now;
    next.updated_at = next.updated_at ?? now;
  }

  if (table === 'child_learning_stats') {
    next.perfect_session_count = next.perfect_session_count ?? 0;
    next.genre_explorer_count = next.genre_explorer_count ?? 0;
    next.updated_at = next.updated_at ?? now;
  }

  if (table === 'child_genre_progress') {
    next.created_at = next.created_at ?? next.first_completed_at ?? now;
  }

  if (table === 'child_subject_stats') {
    next.session_count = next.session_count ?? 0;
    next.updated_at = next.updated_at ?? now;
  }

  if (table === 'child_badges') {
    next.unlocked_at = next.unlocked_at ?? next.created_at ?? now;
    next.latest_progress = next.latest_progress ?? 0;
    next.created_at = next.created_at ?? next.unlocked_at ?? now;
  }

  if (table === 'badge_unlock_events') {
    next.created_at = next.created_at ?? now;
  }

  if (table === 'parent_reauth_challenges') {
    next.guardian_id = mapValue(next.guardian_id ?? next.user_id, maps.guardians);
    next.verified_at = next.verified_at ?? now;
    next.created_at = next.created_at ?? now;
  }

  return next;
}

function upsertSql(table, row) {
  const columns = tableColumns[table];
  const values = columns.map((column) => sqlValue(column, row[column]));
  const conflictTarget = conflictTargets[table];
  const updateColumns = columns.filter((column) => !conflictTarget.includes(column));
  const updates = updateColumns.map((column) => `${column} = excluded.${column}`).join(',\n  ');

  return `
INSERT INTO ${table} (
  ${columns.join(', ')}
) VALUES (
  ${values.join(', ')}
)
ON CONFLICT(${conflictTarget.join(', ')}) DO UPDATE SET
  ${updates};`;
}

const maps = {
  guardians: await readMapFile(guardianMapFile),
  questions: await buildQuestionMap(),
};

const statements = ['PRAGMA foreign_keys = ON;'];
const metrics = {};

for (const table of orderedTables) {
  const rows = await readJsonIfExists(`${table}.json`);
  metrics[table] = rows.length;
  for (const row of rows) {
    statements.push(upsertSql(table, normalizeRow(table, row, maps)));
  }
}

statements.push('PRAGMA foreign_key_check;');

console.log(JSON.stringify({
  database: databaseName,
  export_dir: legacyExportDir,
  guardian_map_entries: maps.guardians.size,
  question_map_entries: maps.questions.size,
  rows: metrics,
}, null, 2));

const sql = `${statements.join('\n')}\n`;

if (isDryRun) {
  console.log(sql);
  process.exit(0);
}

const tempDir = await mkdtemp(join(tmpdir(), 'quizly-legacy-import-'));
const sqlPath = join(tempDir, 'legacy-learning-data.sql');

try {
  await writeFile(sqlPath, sql, 'utf8');
  const result = spawnSync(
    'npx',
    ['wrangler', 'd1', 'execute', databaseName, ...wranglerEnvArgs, '--remote', '--file', sqlPath],
    { stdio: 'inherit' },
  );

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
