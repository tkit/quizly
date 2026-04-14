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

loadEnvFile(path.join(process.cwd(), '.env.local'));
loadEnvFile(path.join(process.cwd(), '.env.content.local'));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SECRET_KEY;
const contentBucket = process.env.CONTENT_BUCKET || 'quiz-content';
const questionImageBucket = process.env.QUESTION_IMAGE_BUCKET || 'quiz-images';

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY');
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const { data: bucketList, error: bucketListError } = await supabase.storage.listBuckets();
if (bucketListError) {
  throw bucketListError;
}

const hasContentBucket = (bucketList ?? []).some((bucket) => bucket.name === contentBucket);
if (!hasContentBucket) {
  const { error: createBucketError } = await supabase.storage.createBucket(contentBucket, {
    public: false,
    fileSizeLimit: '10MB',
  });
  if (createBucketError) {
    throw createBucketError;
  }
  console.log(`[upload-dev-test-content] created content bucket (private): ${contentBucket}`);
}

const hasImageBucket = (bucketList ?? []).some((bucket) => bucket.name === questionImageBucket);
if (!hasImageBucket) {
  const { error: createBucketError } = await supabase.storage.createBucket(questionImageBucket, {
    public: true,
    fileSizeLimit: '10MB',
  });
  if (createBucketError) {
    throw createBucketError;
  }
  console.log(`[upload-dev-test-content] created image bucket (public): ${questionImageBucket}`);
}

const uploads = [
  {
    localPath: path.join(process.cwd(), 'contents/dev-image-test.json'),
    objectKey: 'dev/tests/dev-image-test.json',
    contentType: 'application/json',
    bucket: contentBucket,
  },
  {
    localPath: path.join(process.cwd(), 'public/icons/icon-192.png'),
    objectKey: 'dev/triangle-01.png',
    contentType: 'image/png',
    bucket: questionImageBucket,
  },
  {
    localPath: path.join(process.cwd(), 'public/icons/icon-512.png'),
    objectKey: 'dev/clock-03-00.png',
    contentType: 'image/png',
    bucket: questionImageBucket,
  },
];

for (const item of uploads) {
  const fileBuffer = fs.readFileSync(item.localPath);
  const { error } = await supabase
    .storage
    .from(item.bucket)
    .upload(item.objectKey, fileBuffer, { upsert: true, contentType: item.contentType });

  if (error) {
    throw error;
  }

  console.log(`[upload-dev-test-content] uploaded: ${item.bucket}/${item.objectKey}`);
}
