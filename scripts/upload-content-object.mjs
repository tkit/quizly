import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

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

function parseArgs(argv) {
  const values = new Map();
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const [keyPart, valuePart] = token.slice(2).split('=', 2);
    if (!keyPart) continue;
    if (valuePart != null) {
      values.set(keyPart, valuePart);
      continue;
    }
    const next = argv[i + 1];
    if (next != null && !next.startsWith('-')) {
      values.set(keyPart, next);
      i += 1;
    }
  }
  return values;
}

function requiredValue(values, key) {
  const value = values.get(key);
  if (!value) {
    throw new Error(`Missing required option: --${key}`);
  }
  return value;
}

function inferContentType(filePath) {
  if (filePath.endsWith('.json')) return 'application/json';
  return 'application/octet-stream';
}

loadEnvFile(path.join(process.cwd(), '.env.local'));
loadEnvFile(path.join(process.cwd(), '.env.content.local'));

const args = parseArgs(process.argv.slice(2));
const localPath = path.resolve(process.cwd(), requiredValue(args, 'local-path'));
const objectKey = requiredValue(args, 'object-key').replace(/^\/+/, '');
const bucket = args.get('bucket') || process.env.CONTENT_BUCKET || 'quiz-content';
const contentType = args.get('content-type') || inferContentType(localPath);

if (!fs.existsSync(localPath)) {
  throw new Error(`Local file not found: ${localPath}`);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SECRET_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY');
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
if (bucketError) throw bucketError;

const hasBucket = (buckets ?? []).some((item) => item.name === bucket);
if (!hasBucket) {
  throw new Error(`Bucket not found: ${bucket}`);
}

const fileBuffer = fs.readFileSync(localPath);
const { error: uploadError } = await supabase
  .storage
  .from(bucket)
  .upload(objectKey, fileBuffer, { upsert: true, contentType });

if (uploadError) throw uploadError;

console.log(`[upload-content-object] uploaded: ${bucket}/${objectKey}`);
