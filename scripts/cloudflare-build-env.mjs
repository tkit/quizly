import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const envFlagIndex = args.indexOf("--env");
const wranglerEnv = envFlagIndex >= 0 ? args[envFlagIndex + 1] : undefined;

const productionDefaults = {
  NEXT_PUBLIC_SITE_URL: "https://quizly.stdy.workers.dev",
  NEXT_PUBLIC_AUTH_MODE: "production",
  NEXT_PUBLIC_ENABLE_DEV_AUTH_SHORTCUT: "false",
};
const stagingDefaults = {
  ...productionDefaults,
  NEXT_PUBLIC_SITE_URL: "https://quizly-staging.stdy.workers.dev",
};
const localDefaults = {
  ...productionDefaults,
  NEXT_PUBLIC_SITE_URL: "http://localhost:8788",
};

const defaults =
  wranglerEnv === "cloudflare-local" ? localDefaults : wranglerEnv === "staging" ? stagingDefaults : productionDefaults;

for (const [key, value] of Object.entries(defaults)) {
  if (!process.env[key]) {
    process.env[key] = value;
  }
}

const scriptDir = dirname(fileURLToPath(import.meta.url));
const cliPath = join(scriptDir, "../node_modules/@opennextjs/cloudflare/dist/cli/index.js");
const child = spawn(process.execPath, [cliPath, ...args], {
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
