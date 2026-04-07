import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const rawArgs = process.argv.slice(2);
const COMMAND = rawArgs[0];

function parseCliOptions(args) {
  const flags = new Set();
  const values = new Map();

  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];
    if (!token.startsWith('-')) continue;

    if (token === '-h') {
      flags.add('help');
      continue;
    }

    if (!token.startsWith('--')) continue;

    const [keyPart, valuePart] = token.slice(2).split('=', 2);
    if (!keyPart) continue;

    if (valuePart != null) {
      values.set(keyPart, valuePart);
      continue;
    }

    const next = args[i + 1];
    if (next != null && !next.startsWith('-')) {
      values.set(keyPart, next);
      i += 1;
      continue;
    }

    flags.add(keyPart);
  }

  return { flags, values };
}

const cli = parseCliOptions(rawArgs.slice(1));
const isDryRun = cli.flags.has('dry-run') || cli.values.get('dry-run') === 'true';
const isHelp =
  cli.flags.has('help') ||
  COMMAND === '--help' ||
  COMMAND === '-h' ||
  COMMAND === 'help' ||
  !COMMAND;

function printUsage() {
  console.log('Usage:');
  console.log('  node scripts/content-sync.mjs validate [options]');
  console.log('  node scripts/content-sync.mjs sync [--dry-run] [options]');
  console.log('');
  console.log('Options:');
  console.log('  --supabase-url <url>            overrides NEXT_PUBLIC_SUPABASE_URL');
  console.log('  --service-role-key <key>        overrides SUPABASE_SECRET_KEY');
  console.log('  --content-bucket <bucket>       overrides CONTENT_BUCKET');
  console.log('  --content-object-key <key>      required (no env fallback)');
  console.log('  --upstash-url <url>             overrides UPSTASH_REDIS_REST_URL');
  console.log('  --upstash-token <token>         overrides UPSTASH_REDIS_REST_TOKEN');
  console.log('');
  console.log('Required env vars (unless overridden by options):');
  console.log('  NEXT_PUBLIC_SUPABASE_URL');
  console.log('  SUPABASE_SECRET_KEY');
  console.log('  CONTENT_BUCKET');
}

if (isHelp) {
  printUsage();
  process.exit(0);
}

if (!['validate', 'sync'].includes(COMMAND)) {
  console.error(`[content-sync] Unknown command: ${COMMAND}`);
  printUsage();
  process.exit(1);
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const idx = trimmed.indexOf('=');
    if (idx <= 0) continue;

    const key = trimmed.slice(0, idx).trim();
    if (!key || process.env[key] != null) continue;

    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnvFile(path.join(process.cwd(), '.env.local'));
loadEnvFile(path.join(process.cwd(), '.env.content.local'));

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`[content-sync] Missing required env var: ${name}`);
  }
  return value;
}

function fromCliOrEnv(optionKey, envKey, required = true) {
  const optionValue = cli.values.get(optionKey);
  if (optionValue != null && optionValue.length > 0) {
    return optionValue;
  }

  if (!required) {
    return process.env[envKey] ?? null;
  }

  return requiredEnv(envKey);
}

function requiredCliOption(optionKey) {
  const value = cli.values.get(optionKey);
  if (value == null || value.length === 0) {
    throw new Error(`[content-sync] Missing required option: --${optionKey}`);
  }
  return value;
}

const supabaseUrl = fromCliOrEnv('supabase-url', 'NEXT_PUBLIC_SUPABASE_URL');
const serviceRoleKey = fromCliOrEnv('service-role-key', 'SUPABASE_SECRET_KEY');
const contentBucket = fromCliOrEnv('content-bucket', 'CONTENT_BUCKET');
const contentObjectKey = requiredCliOption('content-object-key');
const upstashUrl = fromCliOrEnv('upstash-url', 'UPSTASH_REDIS_REST_URL', false);
const upstashToken = fromCliOrEnv('upstash-token', 'UPSTASH_REDIS_REST_TOKEN', false);
const DASHBOARD_CATALOG_CACHE_KEY = 'quizly:dashboard:catalog:v1';
const QUIZ_ORDER_VERSION_KEY_PREFIX = 'quizly:quiz_order_version:v1:';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

async function runRedisCommand(command) {
  if (!upstashUrl || !upstashToken) {
    return null;
  }

  const response = await fetch(upstashUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${upstashToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  });

  if (!response.ok) {
    throw new Error(`[content-sync] Upstash command failed: ${response.status}`);
  }

  const json = await response.json();
  if (json?.error) {
    throw new Error(`[content-sync] Upstash command error: ${json.error}`);
  }

  return json?.result ?? null;
}

async function invalidateDashboardCatalogCache() {
  if (!upstashUrl || !upstashToken) {
    console.log('[content-sync] Dashboard cache invalidation skipped (Upstash env vars are not set)');
    return;
  }

  await runRedisCommand(['DEL', DASHBOARD_CATALOG_CACHE_KEY]);
  console.log('[content-sync] Dashboard catalog cache invalidated');
}

async function invalidateQuizQuestionSetCache(plan) {
  if (!upstashUrl || !upstashToken) {
    console.log('[content-sync] Quiz question-set cache invalidation skipped (Upstash env vars are not set)');
    return;
  }

  const genreIds = new Set();
  for (const row of plan.inserts) genreIds.add(row.genre_id);
  for (const row of plan.updates) genreIds.add(row.genre_id);
  for (const row of plan.deactivations) genreIds.add(row.genre_id);

  if (genreIds.size === 0) {
    console.log('[content-sync] Quiz question-set cache invalidation skipped (no question changes)');
    return;
  }

  for (const genreId of genreIds) {
    await runRedisCommand(['INCR', `${QUIZ_ORDER_VERSION_KEY_PREFIX}${genreId}`]);
  }

  console.log(`[content-sync] Quiz question-set cache invalidated for ${genreIds.size} genres`);
}

function toGenreId(mode) {
  return `jp-grammar-${String(mode).padStart(2, '0')}`;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`[content-sync] ${message}`);
  }
}

function normalizeLegacyRows(rows) {
  assert(Array.isArray(rows), 'Content JSON must be an array');
  assert(rows.length > 0, 'Content JSON is empty');

  const normalized = [];
  const titleByMode = new Map();
  const seenQuestionKey = new Set();

  for (const row of rows) {
    const mode = Number(row.mode);
    const title = String(row.title ?? '').trim();
    const question = String(row.question ?? '').trim();
    const choices = Array.isArray(row.choices) ? row.choices.map((choice) => String(choice)) : [];
    const answer = String(row.answer ?? '').trim();
    const explanation = String(row.explanation ?? '').trim();

    assert(Number.isInteger(mode) && mode >= 1 && mode <= 20, `Invalid mode: ${row.mode}`);
    assert(title.length > 0, `Missing title in mode ${mode}`);
    assert(question.length > 0, `Missing question in mode ${mode}`);
    assert(choices.length >= 2, `choices must have at least 2 options in mode ${mode}`);
    assert(answer.length > 0, `Missing answer in mode ${mode}`);
    assert(explanation.length > 0, `Missing explanation in mode ${mode}, question: ${question}`);

    const correctIndex = choices.findIndex((choice) => choice === answer);
    assert(correctIndex >= 0, `answer not found in choices (mode ${mode}): ${question}`);

    const existingTitle = titleByMode.get(mode);
    if (existingTitle == null) {
      titleByMode.set(mode, title);
    } else {
      assert(existingTitle === title, `mode ${mode} has mixed titles: ${existingTitle} / ${title}`);
    }

    const genreId = toGenreId(mode);
    const questionKey = `${genreId}::${question}`;
    assert(!seenQuestionKey.has(questionKey), `Duplicate question key in content: ${questionKey}`);
    seenQuestionKey.add(questionKey);

    normalized.push({
      mode,
      title,
      genre_id: genreId,
      question_text: question,
      options: choices,
      correct_index: correctIndex,
      explanation,
      is_active: true,
    });
  }

  const modes = [...new Set(normalized.map((row) => row.mode))].sort((a, b) => a - b);
  assert(modes.length === 20, `Expected 20 modes, got ${modes.length}`);
  for (let mode = 1; mode <= 20; mode += 1) {
    assert(modes[mode - 1] === mode, `Missing mode ${mode}`);
  }

  const genres = modes.map((mode) => {
    const title = titleByMode.get(mode);
    return {
      id: toGenreId(mode),
      name: `文法マスター 第${mode}回: ${title}`,
      parent_id: 'japanese',
      icon_key: 'notebook',
      description: `${title}の問題で語彙・表現の理解を深めます。`,
      color_hint: 'pink',
    };
  });

  return { normalized, genres };
}

function normalizeManifest(payload) {
  assert(payload != null && typeof payload === 'object', 'Content JSON must be an object in manifest mode');
  assert(Array.isArray(payload.genres), 'manifest.genres must be an array');
  assert(Array.isArray(payload.questions), 'manifest.questions must be an array');
  assert(payload.genres.length > 0, 'manifest.genres is empty');
  assert(payload.questions.length > 0, 'manifest.questions is empty');

  const genres = payload.genres.map((genre, index) => {
    const id = String(genre.id ?? '').trim();
    const name = String(genre.name ?? '').trim();
    const iconKey = String(genre.icon_key ?? '').trim();
    const parentIdRaw = genre.parent_id == null ? null : String(genre.parent_id).trim();
    const parentId = parentIdRaw === '' ? null : parentIdRaw;
    const description = genre.description == null ? null : String(genre.description);
    const colorHint = genre.color_hint == null ? null : String(genre.color_hint);

    assert(id.length > 0, `manifest.genres[${index}].id is required`);
    assert(name.length > 0, `manifest.genres[${index}].name is required`);
    assert(iconKey.length > 0, `manifest.genres[${index}].icon_key is required`);

    return {
      id,
      name,
      parent_id: parentId,
      icon_key: iconKey,
      description,
      color_hint: colorHint,
    };
  });

  const genreIdSet = new Set(genres.map((genre) => genre.id));
  const seenQuestionKey = new Set();

  const normalized = payload.questions.map((row, index) => {
    const genreId = String(row.genre_id ?? '').trim();
    const questionText = String(row.question_text ?? row.question ?? '').trim();
    const options = Array.isArray(row.options)
      ? row.options.map((choice) => String(choice))
      : Array.isArray(row.choices)
        ? row.choices.map((choice) => String(choice))
        : [];
    const explanation = String(row.explanation ?? '').trim();
    const answer = row.answer == null ? null : String(row.answer).trim();
    const correctIndexRaw = row.correct_index;
    const isActive = row.is_active == null ? true : Boolean(row.is_active);

    assert(genreId.length > 0, `manifest.questions[${index}].genre_id is required`);
    assert(genreIdSet.has(genreId), `manifest.questions[${index}] references unknown genre_id: ${genreId}`);
    assert(questionText.length > 0, `manifest.questions[${index}].question_text/question is required`);
    assert(options.length >= 2, `manifest.questions[${index}].options/choices must have at least 2 items`);
    assert(explanation.length > 0, `manifest.questions[${index}].explanation is required`);

    let correctIndex = Number(correctIndexRaw);
    if (answer != null) {
      const answerIndex = options.findIndex((choice) => choice === answer);
      assert(answerIndex >= 0, `manifest.questions[${index}].answer not found in options`);
      correctIndex = answerIndex;
    }

    assert(Number.isInteger(correctIndex), `manifest.questions[${index}].correct_index or answer is required`);
    assert(
      correctIndex >= 0 && correctIndex < options.length,
      `manifest.questions[${index}].correct_index out of range`,
    );

    const key = `${genreId}::${questionText}`;
    assert(!seenQuestionKey.has(key), `Duplicate question key in manifest: ${key}`);
    seenQuestionKey.add(key);

    return {
      genre_id: genreId,
      question_text: questionText,
      options,
      correct_index: correctIndex,
      explanation,
      is_active: isActive,
    };
  });

  return { normalized, genres };
}

function normalizeContentPayload(payload) {
  if (Array.isArray(payload)) {
    return normalizeLegacyRows(payload);
  }
  return normalizeManifest(payload);
}

async function fetchContentRows() {
  const { data, error } = await supabase.storage.from(contentBucket).download(contentObjectKey);
  if (error || !data) {
    throw new Error(`[content-sync] Failed to download content JSON from storage: ${error?.message ?? 'unknown error'}`);
  }

  const text = await data.text();
  const parsed = JSON.parse(text);
  return parsed;
}

function chunk(items, size) {
  const result = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

function normalizeOptions(options) {
  if (Array.isArray(options)) return options.map((opt) => String(opt));
  return [];
}

function rowsEqual(left, right) {
  const leftOptions = normalizeOptions(left.options);
  const rightOptions = normalizeOptions(right.options);
  return (
    JSON.stringify(leftOptions) === JSON.stringify(rightOptions) &&
    Number(left.correct_index) === Number(right.correct_index) &&
    String(left.explanation ?? '') === String(right.explanation ?? '') &&
    Boolean(left.is_active) === Boolean(right.is_active)
  );
}

function previewText(value, max = 80) {
  const text = String(value ?? '');
  if (text.length <= max) return text;
  return `${text.slice(0, max)}...`;
}

function buildQuestionDiff(existing, desired) {
  const diff = {};

  const existingOptions = normalizeOptions(existing.options);
  const desiredOptions = normalizeOptions(desired.options);
  if (JSON.stringify(existingOptions) !== JSON.stringify(desiredOptions)) {
    diff.options = { before: existingOptions, after: desiredOptions };
  }

  if (Number(existing.correct_index) !== Number(desired.correct_index)) {
    diff.correct_index = { before: Number(existing.correct_index), after: Number(desired.correct_index) };
  }

  const beforeExplanation = String(existing.explanation ?? '');
  const afterExplanation = String(desired.explanation ?? '');
  if (beforeExplanation !== afterExplanation) {
    diff.explanation = { before: beforeExplanation, after: afterExplanation };
  }

  if (Boolean(existing.is_active) !== Boolean(desired.is_active)) {
    diff.is_active = { before: Boolean(existing.is_active), after: Boolean(desired.is_active) };
  }

  return diff;
}

async function buildSyncPlan(desiredRows, desiredGenres) {
  const genreIds = desiredGenres.map((genre) => genre.id);

  const { data: existingQuestions, error: existingQuestionsError } = await supabase
    .from('questions')
    .select('id, genre_id, question_text, options, correct_index, explanation, is_active, created_at')
    .in('genre_id', genreIds);

  if (existingQuestionsError) {
    throw new Error(`[content-sync] Failed to fetch existing questions: ${existingQuestionsError.message}`);
  }

  const existingMap = new Map();
  const duplicatesByKey = new Map();
  for (const row of existingQuestions ?? []) {
    const key = `${row.genre_id}::${row.question_text}`;
    const list = duplicatesByKey.get(key) ?? [];
    list.push(row);
    duplicatesByKey.set(key, list);
  }

  for (const [key, rows] of duplicatesByKey.entries()) {
    if (rows.length === 1) {
      existingMap.set(key, rows[0]);
      continue;
    }

    rows.sort((a, b) => {
      const activeScore = Number(Boolean(b.is_active)) - Number(Boolean(a.is_active));
      if (activeScore !== 0) return activeScore;

      const aCreatedAt = new Date(a.created_at ?? 0).getTime();
      const bCreatedAt = new Date(b.created_at ?? 0).getTime();
      return bCreatedAt - aCreatedAt;
    });

    existingMap.set(key, rows[0]);
  }

  const desiredMap = new Map();
  for (const row of desiredRows) {
    const key = `${row.genre_id}::${row.question_text}`;
    desiredMap.set(key, row);
  }

  const inserts = [];
  const updates = [];
  const deactivations = [];
  const duplicateKeys = [];

  for (const [key, desired] of desiredMap.entries()) {
    const existing = existingMap.get(key);
    if (!existing) {
      inserts.push(desired);
      continue;
    }

    const current = {
      options: existing.options,
      correct_index: existing.correct_index,
      explanation: existing.explanation,
      is_active: existing.is_active,
    };

    if (!rowsEqual(current, desired)) {
      const diff = buildQuestionDiff(existing, desired);
      updates.push({
        id: existing.id,
        genre_id: existing.genre_id,
        question_text: existing.question_text,
        options: desired.options,
        correct_index: desired.correct_index,
        explanation: desired.explanation,
        is_active: true,
        diff,
      });
    }
  }

  for (const [key, rows] of duplicatesByKey.entries()) {
    if (rows.length <= 1) continue;

    duplicateKeys.push({ key, count: rows.length });
    const canonical = existingMap.get(key);

    for (const row of rows) {
      if (row.id === canonical?.id) continue;
      if (row.is_active === true) {
        deactivations.push({
          id: row.id,
          genre_id: row.genre_id,
          question_text: row.question_text,
          reason: 'duplicate',
        });
      }
    }
  }

  for (const [key, existing] of existingMap.entries()) {
    if (!desiredMap.has(key) && existing.is_active === true) {
      deactivations.push({
        id: existing.id,
        genre_id: existing.genre_id,
        question_text: existing.question_text,
        reason: 'not_in_source',
      });
    }
  }

  return {
    genres: desiredGenres,
    inserts,
    updates,
    deactivations,
    duplicateKeys,
    desiredCount: desiredRows.length,
    existingCount: (existingQuestions ?? []).length,
  };
}

async function applySyncPlan(plan) {
  const { error: genreError } = await supabase
    .from('genres')
    .upsert(plan.genres, { onConflict: 'id' });

  if (genreError) {
    throw new Error(`[content-sync] Failed to upsert genres: ${genreError.message}`);
  }

  for (const batch of chunk(plan.inserts, 200)) {
    const { error } = await supabase.from('questions').insert(batch);
    if (error) {
      throw new Error(`[content-sync] Failed to insert questions: ${error.message}`);
    }
  }

  for (const updateRow of plan.updates) {
    const { id, ...payload } = updateRow;
    delete payload.genre_id;
    delete payload.question_text;
    delete payload.diff;
    const { data, error } = await supabase
      .from('questions')
      .update(payload)
      .eq('id', id)
      .select('id');
    if (error) {
      throw new Error(`[content-sync] Failed to update question ${id}: ${error.message}`);
    }
    if (!data || data.length === 0) {
      throw new Error(
        `[content-sync] Update affected 0 rows for question ${id}. Check key permissions/RLS (SUPABASE_SECRET_KEY role).`,
      );
    }
  }

  for (const batch of chunk(plan.deactivations, 200)) {
    const idBatch = batch.map((item) => item.id);
    const { data, error } = await supabase
      .from('questions')
      .update({ is_active: false })
      .in('id', idBatch)
      .select('id');

    if (error) {
      throw new Error(`[content-sync] Failed to deactivate questions: ${error.message}`);
    }
    if (!data || data.length === 0) {
      throw new Error(
        `[content-sync] Deactivation affected 0 rows. Check key permissions/RLS (SUPABASE_SECRET_KEY role).`,
      );
    }
  }
}

function printPlan(plan, prefix = '[content-sync]') {
  console.log(`${prefix} target questions: ${plan.desiredCount}`);
  console.log(`${prefix} existing questions in target genres: ${plan.existingCount}`);
  console.log(`${prefix} genres upsert: ${plan.genres.length}`);
  console.log(`${prefix} question inserts: ${plan.inserts.length}`);
  console.log(`${prefix} question updates: ${plan.updates.length}`);
  console.log(`${prefix} question deactivations: ${plan.deactivations.length}`);
  console.log(`${prefix} duplicate keys in existing data: ${plan.duplicateKeys.length}`);

  if (plan.duplicateKeys.length > 0) {
    console.log(`${prefix} duplicate key detail:`);
    for (const row of plan.duplicateKeys.slice(0, 30)) {
      console.log(`  - [duplicate] ${row.key} (${row.count} rows)`);
    }
    if (plan.duplicateKeys.length > 30) {
      console.log(`  - ... and ${plan.duplicateKeys.length - 30} more`);
    }
  }

  if (plan.inserts.length > 0) {
    console.log(`${prefix} inserts detail:`);
    for (const row of plan.inserts) {
      console.log(
        `  - [insert] ${row.genre_id} | ${previewText(row.question_text, 120)}`,
      );
    }
  }

  if (plan.updates.length > 0) {
    console.log(`${prefix} updates detail:`);
    for (const row of plan.updates) {
      const changedFields = Object.keys(row.diff);
      console.log(
        `  - [update] ${row.genre_id} | ${previewText(row.question_text, 120)} | fields: ${changedFields.join(', ')}`,
      );

      for (const field of changedFields) {
        const change = row.diff[field];
        if (field === 'explanation') {
          console.log(`      ${field}:`);
          console.log(`        before: ${previewText(change.before, 120)}`);
          console.log(`        after : ${previewText(change.after, 120)}`);
        } else {
          console.log(`      ${field}: ${JSON.stringify(change.before)} -> ${JSON.stringify(change.after)}`);
        }
      }
    }
  }

  if (plan.deactivations.length > 0) {
    console.log(`${prefix} deactivations detail:`);
    for (const row of plan.deactivations) {
      console.log(
        `  - [deactivate:${row.reason ?? 'unknown'}] ${row.genre_id} | ${previewText(row.question_text, 120)} (${row.id})`,
      );
    }
  }
}

async function main() {
  const payload = await fetchContentRows();
  const { normalized, genres } = normalizeContentPayload(payload);

  if (COMMAND === 'validate') {
    console.log('[content-sync] Validation passed');
    console.log(`[content-sync] rows: ${normalized.length}`);
    console.log(`[content-sync] genres: ${genres.length}`);
    return;
  }

  const plan = await buildSyncPlan(normalized, genres);
  printPlan(plan);

  if (isDryRun) {
    console.log('[content-sync] Dry-run mode: no changes were applied');
    return;
  }

  await applySyncPlan(plan);
  await invalidateDashboardCatalogCache();
  await invalidateQuizQuestionSetCache(plan);
  console.log('[content-sync] Sync completed');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
