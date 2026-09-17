/**
 * Run Postgres-backed API integration tests (Windows-safe env for auth mode).
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const vitest = resolve(root, "node_modules/vitest/vitest.mjs");

const config = resolve(root, "vitest.integration.config.ts");

const result = spawnSync(
  process.execPath,
  [vitest, "run", "--config", config],
  {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      FIELD_API_REQUIRE_AUTH: "1",
    },
  },
);

process.exit(result.status ?? 1);
