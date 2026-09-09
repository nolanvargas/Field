/**
 * Import user list CSV into users.
 *
 * Usage:
 *   node scripts/import-users.mjs
 *   node scripts/import-users.mjs --dry-run
 *   node scripts/import-users.mjs "path/to/users.csv"
 */
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createPgClient } from "./lib/db.mjs";
import { parseCsv, readCsvText } from "./lib/csv.mjs";
import { ALL_PERMISSIONS } from "../shared/permissions.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const csvArg = args.find((a) => !a.startsWith("--"));
const csvPath = resolve(root, csvArg ?? "users.csv");


function normalizeSpace(value) {
  return value.replace(/\s+/g, " ").trim();
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** Names ending in " Admin" get extra access keys; role stays an empty label. */
function parseNameAndAccess(rawName) {
  const collapsed = normalizeSpace(rawName);
  const adminMatch = collapsed.match(/^(.*?)\s+Admin$/i);
  const display_name = adminMatch ? adminMatch[1] : collapsed;
  const permissions = adminMatch ? [...ALL_PERMISSIONS] : [];
  return { display_name, role: "", permissions };
}

function normalizePhone(raw) {
  const s = normalizeSpace(raw);
  if (!s) return null;
  // Export occasionally puts an email in the Phone column
  if (isEmail(s)) return null;
  return s.slice(0, 50);
}

function normalizeEmail(raw) {
  const s = normalizeSpace(raw).toLowerCase();
  if (!s) return null;
  if (!isEmail(s)) {
    throw new Error(`Invalid email: ${raw}`);
  }
  return s.slice(0, 255);
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const text = readCsvText(csvPath);
const csvRows = parseCsv(text);
const [header, ...dataRows] = csvRows;
const expected = ["Name", "Email", "Phone", "ID"];
if (!header || expected.some((h, i) => header[i] !== h)) {
  throw new Error(
    `Unexpected CSV header: ${JSON.stringify(header)}. Expected ${JSON.stringify(expected)}`,
  );
}

const users = [];
const warnings = [];

for (const cols of dataRows) {
  if (cols.every((c) => !normalizeSpace(c ?? ""))) continue;

  const rawName = cols[0] ?? "";
  const rawEmail = cols[1] ?? "";
  const rawPhone = cols[2] ?? "";
  const id = normalizeSpace(cols[3] ?? "").toLowerCase();

  if (!UUID_RE.test(id)) {
    throw new Error(`Invalid user ID for "${rawName}": ${cols[3]}`);
  }

  const { display_name, role, permissions } = parseNameAndAccess(rawName);
  if (!display_name) {
    throw new Error(`Empty display name for id ${id}`);
  }

  const phone = normalizePhone(rawPhone);
  if (normalizeSpace(rawPhone) && isEmail(normalizeSpace(rawPhone))) {
    warnings.push(
      `${display_name}: Phone column looked like email (${normalizeSpace(rawPhone)}); stored phone as null`,
    );
  }

  users.push({
    id,
    display_name: display_name.slice(0, 255),
    email: normalizeEmail(rawEmail),
    phone,
    role,
    permissions,
  });
}

const extraAccess = users.filter((u) => u.permissions.length > 0).length;

console.log(`CSV: ${csvPath}`);
console.log(
  `Parsed ${users.length} users (${extraAccess} with extra access)`,
);
for (const w of warnings) console.log(` warning: ${w}`);

if (dryRun) {
  for (const u of users.slice(0, 4)) {
    console.log(" sample:", JSON.stringify(u));
  }
  const rick = users.find((u) => u.display_name.includes("Rick"));
  const joe = users.find((u) => u.display_name.includes("Joe"));
  if (rick) console.log(" crew sample:", JSON.stringify(rick));
  if (joe) console.log(" phone-fix sample:", JSON.stringify(joe));
  console.log("(dry-run — no database writes)");
  process.exit(0);
}

const client = createPgClient();

await client.connect();

try {
  const { rows: existing } = await client.query(
    "SELECT count(*)::int AS n FROM users",
  );
  if (existing[0].n > 0) {
    throw new Error(
      `users already has ${existing[0].n} rows. Truncate or clear before re-import.`,
    );
  }

  await client.query("BEGIN");

  for (const u of users) {
    await client.query(
      `INSERT INTO users (id, display_name, email, phone, role, permissions)
       VALUES ($1, $2, $3, $4, $5, $6::text[])`,
      [u.id, u.display_name, u.email, u.phone, u.role, u.permissions],
    );
  }

  await client.query("COMMIT");
  console.log(`Imported: ${users.length} users`);
} catch (err) {
  await client.query("ROLLBACK");
  throw err;
} finally {
  await client.end();
}
