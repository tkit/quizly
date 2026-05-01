#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const databaseName = process.env.D1_DATABASE_NAME ?? 'quizly-staging';
const wranglerEnv = process.env.WRANGLER_ENV ?? 'staging';
const wranglerEnvArgs = wranglerEnv ? ['--env', wranglerEnv] : [];

const sql = `
UPDATE questions
SET image_url = CASE image_url
  WHEN 'dev/triangle-01.png' THEN 'dev/triangle-01.svg'
  WHEN 'dev/clock-03-00.png' THEN 'dev/clock-03-00.svg'
  ELSE image_url
END
WHERE image_url IN ('dev/triangle-01.png', 'dev/clock-03-00.png');
`;

const result = spawnSync(
  'npx',
  ['wrangler', 'd1', 'execute', databaseName, ...wranglerEnvArgs, '--remote', '--command', sql],
  { stdio: 'inherit' },
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
