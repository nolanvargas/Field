/**
 * Seed users, venue addresses, and contacts for Sandbocks (local dev org).
 * Matches IDs/UUIDs expected by scripts/seed-dev-tasks.mjs.
 * All people names are fictional — not real staff or contacts.
 * See docs/official-orgs.md.
 *
 * Usage:
 *   node scripts/seed-dev-data.mjs
 *   node scripts/seed-dev-data.mjs --replace   # clear and re-seed
 */
import { createPgClient } from "./lib/db.mjs";
import { ALL_PERMISSIONS } from "../shared/permissions.js";

const replace = process.argv.includes("--replace");

const EXTRA_ACCESS = [...ALL_PERMISSIONS];

/** @type {{ id: string, display_name: string, email: string, phone: string | null, role: string, permissions: string[] }[]} */
const USERS = [
  { id: "e79c25d5-06b4-4468-b7a9-04a9718f5e72", display_name: "Alex Rivera", email: "alex.rivera@example.com", phone: "5550101", role: "crew", permissions: [] },
  { id: "380d8088-2312-450c-bfbe-a73249a6b0b6", display_name: "Blake Chen", email: "blake.chen@example.com", phone: "5550102", role: "crew", permissions: [] },
  { id: "6cd68c05-7c5b-4f70-96de-230b9049278b", display_name: "Casey Morgan", email: "casey.morgan@example.com", phone: "5550103", role: "crew", permissions: [] },
  { id: "b2dc58ff-a481-4ed5-9939-dc494affc73c", display_name: "Dana Brooks", email: "dana.brooks@example.com", phone: null, role: "crew", permissions: [] },
  { id: "72b9aa65-fba7-4394-afe3-9152eeefc5eb", display_name: "Ellis Park", email: "ellis.park@example.com", phone: "5550105", role: "crew", permissions: [] },
  { id: "9f2676c6-3056-40cd-b976-c5794ba54539", display_name: "Flynn Reed", email: "flynn.reed@example.com", phone: "5550106", role: "crew", permissions: [] },
  { id: "78d32507-d947-4d4d-b8d5-1c025c56c2be", display_name: "Gray Santos", email: "gray.santos@example.com", phone: "5550107", role: "crew", permissions: [] },
  { id: "dda0562e-c5cd-4323-81c2-aa3cc9085d77", display_name: "Harper Quinn", email: "harper.quinn@example.com", phone: "5550108", role: "crew", permissions: [] },
  { id: "23e2bebb-362e-47aa-9ca0-1fc19059fbed", display_name: "Ivy Tran", email: "ivy.tran@example.com", phone: "5550109", role: "crew", permissions: [] },
  { id: "f27b59cf-acbb-4fac-b0e9-1df4dfaa2d5d", display_name: "Jamie Kim", email: "jamie.kim@example.com", phone: "5550110", role: "crew", permissions: [] },
  { id: "a6c2a0c2-6266-4b3a-b786-eeae20667afe", display_name: "Logan Reed", email: "logan.reed@example.com", phone: "5550201", role: "admin", permissions: EXTRA_ACCESS },
  { id: "b1d056ad-01b1-47c6-8045-347c1b214652", display_name: "Nina Ortiz", email: "nina.ortiz@example.com", phone: "5550202", role: "admin", permissions: EXTRA_ACCESS },
  { id: "010e63a8-9b24-4520-bf76-cb32b28647c2", display_name: "Olivia Shaw", email: "olivia.shaw@example.com", phone: "5550203", role: "admin", permissions: EXTRA_ACCESS },
  { id: "3eebbc14-08db-43ce-8c4d-41505b3c914a", display_name: "Parker Hale", email: "parker.hale@example.com", phone: "5550204", role: "admin", permissions: EXTRA_ACCESS },
  { id: "cb28949b-650d-4b94-9032-41fa82919255", display_name: "Quinn Ellis", email: "quinn.ellis@example.com", phone: "5550205", role: "admin", permissions: EXTRA_ACCESS },
];

/** IDs must match scripts/seed-dev-tasks.mjs V.* constants. */
/** @type {{ id: number, address_name: string, street_line: string, building?: string | null, notes?: string | null }[]} */
const ADDRESSES = [
  { id: 125, address_name: "Park MGM", street_line: "3770 S Las Vegas Blvd, Las Vegas, NV 89109" },
  { id: 126, address_name: "Sunset Station", street_line: "1301 W Sunset Rd, Henderson, NV 89014" },
  { id: 134, address_name: "Las Vegas Aces HQ", street_line: "7575 S Dean Martin Dr, Las Vegas, NV 89139" },
  { id: 138, address_name: "Aria", street_line: "3730 S Las Vegas Blvd, Las Vegas, NV 89158" },
  { id: 140, address_name: "Bellagio", street_line: "3600 S Las Vegas Blvd, Las Vegas, NV 89109" },
  { id: 144, address_name: "Boulder Station", street_line: "4111 Boulder Hwy, Las Vegas, NV 89121" },
  { id: 147, address_name: "Cirque Warehouse", street_line: "6325 S Pecos Rd, Las Vegas, NV 89120", building: "Warehouse B" },
  { id: 148, address_name: "City National Arena", street_line: "1525 Packerham Ave, Las Vegas, NV 89135" },
  { id: 149, address_name: "Container Park", street_line: "707 Fremont St, Las Vegas, NV 89101" },
  { id: 162, address_name: "Grand Garden Arena", street_line: "3799 S Las Vegas Blvd, Las Vegas, NV 89109" },
  { id: 165, address_name: "MGM Grand", street_line: "3799 S Las Vegas Blvd, Las Vegas, NV 89109" },
  { id: 181, address_name: "Luxor", street_line: "3900 S Las Vegas Blvd, Las Vegas, NV 89119", building: "Marketing dock A" },
  { id: 182, address_name: "Mandalay Bay", street_line: "3950 S Las Vegas Blvd, Las Vegas, NV 89119", building: "Sign shop" },
  { id: 190, address_name: "Michelob ULTRA Arena", street_line: "3950 S Mandalay Bay Rd, Las Vegas, NV 89119" },
  { id: 194, address_name: "The Palazzo", street_line: "3325 S Las Vegas Blvd, Las Vegas, NV 89109", building: "Receiving" },
  { id: 199, address_name: "Palace Station", street_line: "2411 W Sahara Ave, Las Vegas, NV 89102" },
  { id: 200, address_name: "Resorts World", street_line: "3000 S Las Vegas Blvd, Las Vegas, NV 89109" },
  { id: 219, address_name: "T-Mobile Arena", street_line: "3780 S Las Vegas Blvd, Las Vegas, NV 89158" },
];

/** IDs must match scripts/seed-dev-tasks.mjs enrichContacts + task contact refs. */
/** @type {{ id: number, name: string, phone: string | null, email: string | null, title?: string | null }[]} */
const CONTACTS = [
  { id: 117, name: "Riley Hayes", phone: "555010117", email: "riley.hayes@example.com", title: "Receiving Lead" },
  { id: 118, name: "Sage Mitchell", phone: "555010118", email: "sage.mitchell@example.com", title: "Marketing Coordinator" },
  { id: 119, name: "Taylor Brooks", phone: "555010119", email: "taylor.brooks@example.com", title: "Electrical Manager" },
  { id: 120, name: "Uma Patel", phone: "555010120", email: "uma.patel@example.com", title: "Events Manager" },
  { id: 121, name: "Vera Collins", phone: "555010121", email: "vera.collins@example.com", title: "F&B Ops" },
  { id: 123, name: "Wade Nguyen", phone: "555010123", email: "wade.nguyen@example.com", title: "Facilities" },
  { id: 124, name: "Xander Cole", phone: "555010124", email: "xander.cole@example.com", title: "Project Manager" },
  { id: 125, name: "Yael Friedman", phone: "555010125", email: "yael.friedman@example.com", title: "Brand Manager" },
];

async function wipeTasks(client) {
  await client.query(`DELETE FROM task_attachments`);
  await client.query(`DELETE FROM task_documents`);
  await client.query(`DELETE FROM email_deliveries`);
  await client.query(`DELETE FROM task_crew_events`);
  await client.query(`DELETE FROM task_history_events`);
  await client.query(`DELETE FROM tasks`);
}

const client = createPgClient();
await client.connect();

try {
  const counts = await client.query(`
    SELECT
      (SELECT count(*)::int FROM users) AS users,
      (SELECT count(*)::int FROM addresses) AS addresses,
      (SELECT count(*)::int FROM contacts) AS contacts
  `);
  const { users, addresses, contacts } = counts.rows[0];
  const hasData = users > 0 || addresses > 0 || contacts > 0;

  if (hasData && !replace) {
    throw new Error(
      `Database already has data (users=${users}, addresses=${addresses}, contacts=${contacts}). ` +
        "Pass --replace to clear and re-seed.",
    );
  }

  await client.query("BEGIN");

  if (replace && hasData) {
    await wipeTasks(client);
    await client.query("DELETE FROM mobile_devices");
    await client.query("DELETE FROM mobile_activation_codes");
    await client.query("DELETE FROM contacts");
    await client.query("DELETE FROM addresses");
    await client.query("DELETE FROM users");
    console.log(
      "Cleared existing tasks, mobile sessions, users, addresses, and contacts.",
    );
  }

  for (const u of USERS) {
    await client.query(
      `INSERT INTO users (id, display_name, email, phone, role, permissions)
       VALUES ($1::uuid, $2, $3, $4, $5, $6::text[])`,
      [u.id, u.display_name, u.email, u.phone, u.role, u.permissions],
    );
  }

  for (const a of ADDRESSES) {
    await client.query(
      `INSERT INTO addresses (id, address_name, street_line, building, notes)
       OVERRIDING SYSTEM VALUE
       VALUES ($1, $2, $3, $4, $5)`,
      [a.id, a.address_name, a.street_line, a.building ?? null, a.notes ?? null],
    );
  }

  await client.query(
    `SELECT setval(pg_get_serial_sequence('addresses', 'id'), (SELECT COALESCE(MAX(id), 1) FROM addresses))`,
  );

  for (const c of CONTACTS) {
    await client.query(
      `INSERT INTO contacts (id, name, phone, email, title)
       OVERRIDING SYSTEM VALUE
       VALUES ($1, $2, $3, $4, $5)`,
      [c.id, c.name, c.phone, c.email, c.title ?? null],
    );
  }

  await client.query(
    `SELECT setval(pg_get_serial_sequence('contacts', 'id'), (SELECT COALESCE(MAX(id), 1) FROM contacts))`,
  );

  await client.query("COMMIT");

  console.log(`Seeded ${USERS.length} users, ${ADDRESSES.length} venues, ${CONTACTS.length} contacts.`);
  console.log("Next: npm run db:seed-dev-tasks");
} catch (err) {
  await client.query("ROLLBACK");
  throw err;
} finally {
  await client.end();
}
