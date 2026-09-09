import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createPgClient } from "./lib/db.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const migrationsDir = resolve(root, "db/migrations");

const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const probe = createPgClient();
await probe.connect();
let hasUsersTable = false;
try {
  const { rowCount } = await probe.query(
    `SELECT 1
     FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name = 'users'`,
  );
  hasUsersTable = rowCount > 0;
} finally {
  await probe.end();
}

const toApply = hasUsersTable
  ? files.filter((f) => f !== "001_initial_schema.sql")
  : files;

let applied = 0;
let skipped = 0;

for (const file of toApply) {
  const sqlPath = resolve(migrationsDir, file);
  const sql = readFileSync(sqlPath, "utf8");
  const client = createPgClient();
  await client.connect();
  process.stdout.write(`Applying ${file}... `);
  try {
    await client.query(sql);
    console.log("ok");
    applied += 1;
  } catch (err) {
    console.log(`skip (${err.message})`);
    skipped += 1;
  } finally {
    await client.end();
  }
}

console.log(`Done. Applied ${applied}, skipped ${skipped}.`);

if (applied > 0 || hasUsersTable) {
  const { spawnSync } = await import("node:child_process");
  const seedScript = resolve(root, "scripts/seed-print-templates.mjs");
  process.stdout.write("Seeding print templates... ");
  const seed = spawnSync(process.execPath, [seedScript], {
    cwd: root,
    stdio: "inherit",
  });
  if (seed.status === 0) {
    console.log("ok");
  } else {
    console.log(`failed (exit ${seed.status ?? "unknown"})`);
  }
}
