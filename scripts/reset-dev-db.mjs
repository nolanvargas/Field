/**
 * Wipe and re-seed the full local dev database (Sandbocks) with dates anchored to today.
 *
 * Clears users, venues, contacts, mobile device sessions, and tasks, then
 * re-inserts the standard dev seed set. Restores org catalog to product defaults.
 * Task windows shift to Pacific "today" so relative times (e.g. "2h ago") look current.
 *
 * See docs/official-orgs.md.
 *
 * Usage:
 *   node scripts/reset-dev-db.mjs
 *   node scripts/reset-dev-db.mjs --dry-run
 */
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const dryRun = process.argv.includes("--dry-run");

/**
 * @param {string} script
 * @param {string[]} args
 */
function runScript(script, args = []) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(
      process.execPath,
      [resolve(root, "scripts", script), ...args],
      { stdio: "inherit", cwd: root, env: process.env },
    );
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${script} exited with code ${code}`));
    });
  });
}

if (dryRun) {
  console.log(
    "Dry run: would run seed-dev-data --replace, reset-org-config, then seed-dev-tasks --dry-run",
  );
  await runScript("reset-org-config.mjs", ["--dry-run"]);
  await runScript("seed-dev-tasks.mjs", ["--dry-run"]);
} else {
  console.log("Resetting Sandbocks dev database…");
  await runScript("seed-dev-data.mjs", ["--replace"]);
  await runScript("reset-org-config.mjs");
  await runScript("seed-dev-tasks.mjs");
  console.log("Sandbocks dev database reset complete.");
}
