/**
 * Minimal users + tasks for mobile integration tests.
 * Uses stable UUIDs from scripts/seed-dev-data.mjs.
 */
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ALL_PERMISSIONS } from "../../../shared/permissions.js";
import { hashSecret, mintActivationCode } from "../../../server/mobileAuth.mjs";
import { generateTrackingToken } from "../../../server/trackingToken.mjs";
import { cleanupIntegrationPrintTemplate } from "./printTemplateFixtures.mjs";

export const FIXTURE_USERS = {
  alex: "e79c25d5-06b4-4468-b7a9-04a9718f5e72",
  blake: "380d8088-2312-450c-bfbe-a73249a6b0b6",
  logan: "a6c2a0c2-6266-4b3a-b786-eeae20667afe",
};

const EXTERNAL_KEY_PREFIX = "inttest-";

const storageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "storage",
);

/**
 * @param {string} storageKey
 * @param {number} [byteLength]
 */
export async function writeIntegrationStorageFile(storageKey, byteLength = 128) {
  const fullPath = path.join(storageRoot, storageKey);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, Buffer.alloc(byteLength));
}

/**
 * @param {import('pg').Client} client
 */
export async function seedIntegrationFixtures(client) {
  await cleanupIntegrationFixtures(client);

  // CI schema retires catalog types (empty production org). createTask rejects
  // retired types, so ensure exactly one active Delivery type exists.
  {
    const activeDelivery = await client.query(
      `SELECT id FROM org_task_types
       WHERE retired_at IS NULL
         AND (lower(name) = 'delivery' OR lower(slug) = 'delivery')
       LIMIT 1`,
    );
    if (activeDelivery.rowCount === 0) {
      const revived = await client.query(
        `UPDATE org_task_types
         SET retired_at = NULL,
             enabled = true
         WHERE id = (
           SELECT id FROM org_task_types
           WHERE lower(name) = 'delivery' OR lower(slug) = 'delivery'
           ORDER BY id
           LIMIT 1
         )
         RETURNING id`,
      );
      if (revived.rowCount === 0) {
        await client.query(
          `INSERT INTO org_task_types (name, slug, icon, enabled, sort_order)
           VALUES ('Delivery', 'delivery', 'package', true, 0)`,
        );
      }
    }
  }

  await client.query(
    `INSERT INTO users (id, display_name, email, phone, role, permissions)
     VALUES
       ($1::uuid, 'Alex Rivera', 'alex.rivera.inttest@example.com', '5550101', 'Lead Installer', '{}'::text[]),
       ($2::uuid, 'Blake Chen', 'blake.chen.inttest@example.com', '5550102', 'Field Technician', '{}'::text[]),
       ($3::uuid, 'Logan Reed', 'logan.reed.inttest@example.com', '5550201', 'Operations Manager', $4::text[])
     ON CONFLICT (id) DO UPDATE SET
       display_name = EXCLUDED.display_name,
       email = EXCLUDED.email,
       is_active = true,
       permissions = EXCLUDED.permissions`,
    [
      FIXTURE_USERS.alex,
      FIXTURE_USERS.blake,
      FIXTURE_USERS.logan,
      ALL_PERMISSIONS,
    ],
  );

  const alexTask = await client.query(
    `INSERT INTO tasks (
       task_type,
       status,
       description,
       external_key,
       created_by_user_id,
       tracking_token
     ) VALUES (
       'Delivery',
       'Unassigned'::task_status,
       'Integration test — Alex task',
       $1,
       $2::uuid,
       $3
     )
     RETURNING id`,
    [
      `${EXTERNAL_KEY_PREFIX}alex`,
      FIXTURE_USERS.logan,
      generateTrackingToken(),
    ],
  );

  const blakeTask = await client.query(
    `INSERT INTO tasks (
       task_type,
       status,
       description,
       external_key,
       created_by_user_id,
       tracking_token
     ) VALUES (
       'Delivery',
       'Unassigned'::task_status,
       'Integration test — Blake task',
       $1,
       $2::uuid,
       $3
     )
     RETURNING id`,
    [
      `${EXTERNAL_KEY_PREFIX}blake`,
      FIXTURE_USERS.logan,
      generateTrackingToken(),
    ],
  );

  const alexCreatedTask = await client.query(
    `INSERT INTO tasks (
       task_type,
       status,
       description,
       external_key,
       created_by_user_id,
       tracking_token
     ) VALUES (
       'Delivery',
       'Unassigned'::task_status,
       'Integration test — Alex created, not assigned',
       $1,
       $2::uuid,
       $3
     )
     RETURNING id`,
    [
      `${EXTERNAL_KEY_PREFIX}alex-created`,
      FIXTURE_USERS.alex,
      generateTrackingToken(),
    ],
  );

  const alexTaskId = Number(alexTask.rows[0].id);
  const blakeTaskId = Number(blakeTask.rows[0].id);
  const alexCreatedTaskId = Number(alexCreatedTask.rows[0].id);

  await client.query(
    `INSERT INTO task_crew_members (task_id, user_id, is_lead)
     VALUES ($1, $2::uuid, true), ($3, $4::uuid, true)
     ON CONFLICT DO NOTHING`,
    [alexTaskId, FIXTURE_USERS.alex, blakeTaskId, FIXTURE_USERS.blake],
  );

  return { alexTaskId, blakeTaskId, alexCreatedTaskId };
}

/**
 * @param {import('pg').Client} client
 * @param {string} userId
 * @param {string} createdByUserId
 */
export async function insertActivationCode(client, userId, createdByUserId) {
  const code = mintActivationCode();
  const id = randomUUID();
  const { rows } = await client.query(
    `INSERT INTO mobile_activation_codes
       (id, user_id, code_hash, expires_at, created_by_user_id)
     VALUES ($1::uuid, $2::uuid, $3, now() + interval '1 hour', $4::uuid)
     RETURNING id`,
    [id, userId, hashSecret(code), createdByUserId],
  );
  return { code, id: String(rows[0].id) };
}

/**
 * @param {import('pg').Client} client
 * @param {string} activationId
 */
export async function expireActivationCode(client, activationId) {
  await client.query(
    `UPDATE mobile_activation_codes
     SET expires_at = now() - interval '1 minute'
     WHERE id = $1::uuid`,
    [activationId],
  );
}

/**
 * @param {import('pg').Client} client
 * @param {string} activationId
 */
export async function revokeActivationCode(client, activationId) {
  await client.query(
    `UPDATE mobile_activation_codes
     SET revoked_at = now()
     WHERE id = $1::uuid`,
    [activationId],
  );
}

/**
 * @param {import('pg').Client} client
 */
export async function cleanupIntegrationFixtures(client) {
  const fixtureUsers = [
    FIXTURE_USERS.alex,
    FIXTURE_USERS.blake,
    FIXTURE_USERS.logan,
  ];
  const taskIds = await client.query(
    `SELECT id FROM tasks WHERE external_key LIKE $1`,
    [`${EXTERNAL_KEY_PREFIX}%`],
  );
  const ids = taskIds.rows.map((row) => Number(row.id));

  if (ids.length > 0) {
    await client.query(`DELETE FROM task_attachments WHERE task_id = ANY($1::bigint[])`, [
      ids,
    ]);
    await client.query(`DELETE FROM task_documents WHERE task_id = ANY($1::bigint[])`, [
      ids,
    ]);
    await client.query(`DELETE FROM email_deliveries WHERE task_id = ANY($1::bigint[])`, [
      ids,
    ]);
    await client.query(`DELETE FROM task_crew_events WHERE task_id = ANY($1::bigint[])`, [
      ids,
    ]);
    await client.query(`DELETE FROM task_history_events WHERE task_id = ANY($1::bigint[])`, [
      ids,
    ]);
    await client.query(`DELETE FROM task_crew_members WHERE task_id = ANY($1::bigint[])`, [
      ids,
    ]);
    await client.query(`DELETE FROM task_contacts WHERE task_id = ANY($1::bigint[])`, [
      ids,
    ]);
    await client.query(`DELETE FROM tasks WHERE id = ANY($1::bigint[])`, [ids]);
  }

  await client.query(
    `DELETE FROM mobile_devices
     WHERE user_id = ANY($1::uuid[])`,
    [fixtureUsers],
  );
  await client.query(
    `DELETE FROM mobile_activation_codes
     WHERE user_id = ANY($1::uuid[])`,
    [fixtureUsers],
  );

  await cleanupIntegrationPrintTemplate(client);
}
