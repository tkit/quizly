import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const flags = new Set(process.argv.slice(2));
const isDryRun = flags.has('--dry-run');

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

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`[seed-dev-legacy-samples] Missing required env var: ${name}`);
  }
  return value;
}

loadEnvFile(path.join(process.cwd(), '.env.local'));
loadEnvFile(path.join(process.cwd(), '.env.content.local'));

const supabaseUrl = requiredEnv('NEXT_PUBLIC_SUPABASE_URL');
const serviceRoleKey = requiredEnv('SUPABASE_SECRET_KEY');

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const sampleRows = [
  {
    genre_id: 'math-basic-calc',
    question_text: '15 + 27 はいくつですか？',
    options: ['32', '42', '52'],
    correct_index: 1,
    explanation:
      '1の位は 5+7=12 です。2を残して1を十の位に繰り上げると、十の位は 1+2+1=4 なので、答えは42です。',
    is_active: true,
  },
  {
    genre_id: 'math-time',
    question_text: '1日は何時間ですか？',
    options: ['12時間', '20時間', '24時間'],
    correct_index: 2,
    explanation: '1日は24時間です。',
    is_active: true,
  },
  {
    genre_id: 'jp-grammar-01',
    question_text: '「山道」を読むとき、正しいのはどれ？',
    options: ['やまみち', 'さんどう', 'やまどう'],
    correct_index: 0,
    explanation: '和語として読む場合は「やまみち」が正解です。',
    is_active: true,
  },
  {
    genre_id: 'jp-grammar-02',
    question_text: '「あしをひっぱる」の意味として正しいのはどれ？',
    options: ['協力して助ける', 'じゃまをする', '走るのが速い'],
    correct_index: 1,
    explanation: '慣用句「あしをひっぱる」は、じゃまをするという意味です。',
    is_active: true,
  },
];

function keyOf(row) {
  return `${row.genre_id}::${row.question_text}`;
}

async function main() {
  const genreIds = [...new Set(sampleRows.map((row) => row.genre_id))];
  const questionTexts = sampleRows.map((row) => row.question_text);

  const { data, error } = await supabase
    .from('questions')
    .select('id, genre_id, question_text, options, correct_index, explanation, is_active')
    .in('genre_id', genreIds)
    .in('question_text', questionTexts);

  if (error) {
    throw new Error(`[seed-dev-legacy-samples] Failed to read existing questions: ${error.message}`);
  }

  const existingByKey = new Map((data ?? []).map((row) => [keyOf(row), row]));
  const inserts = [];
  const updates = [];

  for (const row of sampleRows) {
    const existing = existingByKey.get(keyOf(row));
    if (!existing) {
      inserts.push(row);
      continue;
    }

    const shouldUpdate =
      JSON.stringify(existing.options ?? []) !== JSON.stringify(row.options) ||
      Number(existing.correct_index) !== Number(row.correct_index) ||
      String(existing.explanation ?? '') !== String(row.explanation ?? '') ||
      Boolean(existing.is_active) !== true;

    if (shouldUpdate) {
      updates.push({ id: existing.id, ...row });
    }
  }

  console.log(`[seed-dev-legacy-samples] existing: ${(data ?? []).length}`);
  console.log(`[seed-dev-legacy-samples] inserts: ${inserts.length}`);
  console.log(`[seed-dev-legacy-samples] updates: ${updates.length}`);
  console.log(`[seed-dev-legacy-samples] mode: ${isDryRun ? 'dry-run' : 'apply'}`);

  if (isDryRun) {
    return;
  }

  if (inserts.length > 0) {
    const { error: insertError } = await supabase.from('questions').insert(inserts);
    if (insertError) {
      throw new Error(`[seed-dev-legacy-samples] Failed to insert samples: ${insertError.message}`);
    }
  }

  for (const row of updates) {
    const { id, ...payload } = row;
    const { error: updateError } = await supabase
      .from('questions')
      .update(payload)
      .eq('id', id);

    if (updateError) {
      throw new Error(`[seed-dev-legacy-samples] Failed to update sample ${id}: ${updateError.message}`);
    }
  }

  console.log('[seed-dev-legacy-samples] completed');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
