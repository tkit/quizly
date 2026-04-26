import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const defaults = {
  NEXT_PUBLIC_SITE_URL: "https://quizly.stdy.workers.dev",
  NEXT_PUBLIC_AUTH_MODE: "production",
  NEXT_PUBLIC_ENABLE_DEV_AUTH_SHORTCUT: "false",
};

for (const [key, value] of Object.entries(defaults)) {
  if (!process.env[key]) {
    process.env[key] = value;
  }
}

delete process.env.NEXT_PUBLIC_SUPABASE_URL;
delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
delete process.env.NEXT_PUBLIC_QUESTION_IMAGE_BUCKET;
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;

const scriptDir = dirname(fileURLToPath(import.meta.url));
const cliPath = join(scriptDir, "../node_modules/@opennextjs/cloudflare/dist/cli/index.js");
const child = spawn(process.execPath, [cliPath, ...process.argv.slice(2)], {
  env: process.env,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
