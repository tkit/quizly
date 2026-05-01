#!/usr/bin/env node
import { readdir } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { spawnSync } from 'node:child_process';

const args = new Set(process.argv.slice(2));
const isDryRun = args.has('--dry-run');
const isLocal = args.has('--local');
const bucketName = process.env.R2_QUESTION_IMAGES_BUCKET ?? 'quizly-question-images-staging';
const sourceDir = process.env.QUESTION_IMAGE_SOURCE_DIR ?? 'assets/question-images';

function contentTypeForPath(path) {
  const lowerPath = path.toLowerCase();
  if (lowerPath.endsWith('.svg')) return 'image/svg+xml';
  if (lowerPath.endsWith('.png')) return 'image/png';
  if (lowerPath.endsWith('.jpg') || lowerPath.endsWith('.jpeg')) return 'image/jpeg';
  if (lowerPath.endsWith('.webp')) return 'image/webp';
  if (lowerPath.endsWith('.gif')) return 'image/gif';
  return 'application/octet-stream';
}

async function listFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(path));
      continue;
    }
    if (entry.isFile()) {
      files.push(path);
    }
  }

  return files;
}

const files = await listFiles(sourceDir);
console.log(`[r2-upload-question-images] bucket=${bucketName} files=${files.length}`);

for (const filePath of files) {
  const key = relative(sourceDir, filePath).split(sep).join('/');
  const contentType = contentTypeForPath(filePath);
  const objectPath = `${bucketName}/${key}`;

  if (isDryRun) {
    console.log(`DRY RUN ${objectPath} content-type=${contentType}`);
    continue;
  }

  const result = spawnSync(
    'npx',
    [
      'wrangler',
      'r2',
      'object',
      'put',
      objectPath,
      '--file',
      filePath,
      '--content-type',
      contentType,
      ...(isLocal ? ['--local'] : ['--remote']),
    ],
    { stdio: 'inherit' },
  );

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
