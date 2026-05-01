#!/usr/bin/env node
import { mkdir } from 'node:fs/promises';
import { basename, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';

const args = new Set(process.argv.slice(2));
const isDryRun = args.has('--dry-run');
const isLocal = args.has('--local');
const bucketName = process.env.R2_CONTENT_BUCKET ?? 'quizly-content-staging';
const objectKey = process.env.CONTENT_OBJECT_KEY ?? 'content/japanese/grammar.json';
const outputDir = process.env.CONTENT_FIXTURE_DIR ?? '.content-sync';
const outputFile = process.env.CONTENT_OUTPUT_FILE ?? basename(objectKey);
const outputPath = `${outputDir}/${outputFile}`;

if (!objectKey || objectKey.includes('..')) {
  throw new Error('CONTENT_OBJECT_KEY must be a safe R2 object key');
}

if (!outputFile.endsWith('.json')) {
  throw new Error('CONTENT_OUTPUT_FILE must end with .json');
}

await mkdir(dirname(outputPath), { recursive: true });

console.log(`[r2-download-content-object] bucket=${bucketName} key=${objectKey} output=${outputPath}`);

if (isDryRun) {
  process.exit(0);
}

const result = spawnSync(
  'npx',
  [
    'wrangler',
    'r2',
    'object',
    'get',
    `${bucketName}/${objectKey}`,
    '--file',
    outputPath,
    ...(isLocal ? ['--local'] : ['--remote']),
  ],
  { stdio: 'inherit' },
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
