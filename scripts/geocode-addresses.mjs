/**
 * Geocode address catalog rows missing coordinates (developer-only).
 *
 * Usage:
 *   node scripts/geocode-addresses.mjs --dry-run
 *   node scripts/geocode-addresses.mjs --confirm --limit 50
 *   node scripts/geocode-addresses.mjs --confirm --ids 1,2,3
 */
import "../server/loadEnv.mjs";
import { geocodeAddressesBatch, loadAddressesMissingCoords } from "../server/geocodeAddresses.mjs";

const dryRun = process.argv.includes("--dry-run");
const confirm = process.argv.includes("--confirm");

/**
 * @param {string} flag
 */
function readFlagValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) return null;
  return value;
}

const limitRaw = readFlagValue("--limit");
const limit =
  limitRaw != null && Number.isFinite(Number(limitRaw))
    ? Math.max(1, Math.floor(Number(limitRaw)))
    : null;

const idsRaw = readFlagValue("--ids");
/** @type {number[] | undefined} */
const ids = idsRaw
  ? idsRaw
      .split(",")
      .map((part) => Number(part.trim()))
      .filter((id) => Number.isInteger(id) && id > 0)
  : undefined;

if (!dryRun && !confirm) {
  console.error(
    "Refusing to run without --dry-run or --confirm. Use --dry-run first.",
  );
  process.exit(1);
}

if (dryRun) {
  const rows = await loadAddressesMissingCoords({ ids, limit });
  console.log(
    `Would geocode ${rows.length} address(es) missing coordinates.`,
  );
  if (rows.length > 0) {
    const preview = rows.slice(0, 10).map((row) => `#${row.id} ${row.streetLine}`);
    console.log(preview.join("\n"));
    if (rows.length > 10) {
      console.log(`…and ${rows.length - 10} more`);
    }
  }
  process.exit(0);
}

console.log("Geocoding addresses via Places Text Search (top match)…");
const result = await geocodeAddressesBatch({ ids, limit });
console.log(
  `Done. attempted=${result.attempted} geocoded=${result.geocoded} failed=${result.failed.length}`,
);
for (const failure of result.failed) {
  console.log(`  #${failure.addressId}: ${failure.reason}`);
}
