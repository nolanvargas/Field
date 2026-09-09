import { randomUUID } from "node:crypto";
import { getPool } from "./db.mjs";
import {
  normalizePermissions,
  permissionsFromDb,
  wouldRemoveOwnManageUsers,
} from "../shared/permissions.js";
import { PERMISSIONS, assertPermission } from "./permissions.mjs";
import {
  parseEntityCustomFields,
  withEntityCustomFields,
} from "./entityCustomFields.mjs";
import { CUSTOM_FIELD_ENTITIES } from "../shared/customFieldEntities.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const USER_SELECT =
  "id, display_name, email, phone, role, permissions, custom_fields";

/**
 * @param {import('pg').QueryResultRow} row
 */
export function mapUserRow(row) {
  return {
    id: String(row.id),
    displayName: row.display_name,
    email: row.email ?? "",
    phone: row.phone ?? "",
    role: row.role ?? "",
    permissions: permissionsFromDb(row.permissions),
  };
}

/**
 * @param {unknown} value
 * @param {string} field
 */
function parseDisplayName(value, field = "displayName") {
  if (value == null || typeof value !== "string") {
    throw Object.assign(new Error(`${field} is required`), { status: 400 });
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw Object.assign(new Error(`${field} is required`), { status: 400 });
  }
  if (trimmed.length > 255) {
    throw Object.assign(new Error(`${field} must be 255 characters or fewer`), {
      status: 400,
    });
  }
  return trimmed;
}

/**
 * @param {unknown} value
 */
function parseOptionalEmail(value) {
  if (value == null) return null;
  if (typeof value !== "string") {
    throw Object.assign(new Error("email must be a string"), { status: 400 });
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > 255) {
    throw Object.assign(new Error("email must be 255 characters or fewer"), {
      status: 400,
    });
  }
  if (!EMAIL_RE.test(trimmed)) {
    throw Object.assign(new Error("email is invalid"), { status: 400 });
  }
  return trimmed.toLowerCase();
}

/**
 * @param {unknown} value
 */
function parseOptionalPhone(value) {
  if (value == null) return null;
  if (typeof value !== "string") {
    throw Object.assign(new Error("phone must be a string"), { status: 400 });
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 50);
}

/**
 * @param {unknown} value
 */
function parseOptionalRole(value) {
  if (value == null) return "";
  if (typeof value !== "string") {
    throw Object.assign(new Error("role must be a string"), { status: 400 });
  }
  return value.trim().slice(0, 50);
}

/**
 * @param {unknown} value
 * @param {boolean} required
 */
function parsePermissions(value, required) {
  if (value == null) {
    if (required) {
      throw Object.assign(new Error("permissions is required"), { status: 400 });
    }
    return [];
  }
  return normalizePermissions(value);
}

/**
 * @param {Record<string, unknown> | null | undefined} body
 * @param {{ requireDisplayName?: boolean }} [opts]
 */
function parseUserBody(body, opts = {}) {
  const payload = body && typeof body === "object" ? body : {};
  const requireDisplayName = opts.requireDisplayName ?? false;

  /** @type {Record<string, unknown>} */
  const out = {};

  if (
    requireDisplayName ||
    Object.prototype.hasOwnProperty.call(payload, "displayName")
  ) {
    out.displayName = parseDisplayName(payload.displayName);
  }
  if (Object.prototype.hasOwnProperty.call(payload, "email")) {
    out.email = parseOptionalEmail(payload.email);
  }
  if (Object.prototype.hasOwnProperty.call(payload, "phone")) {
    out.phone = parseOptionalPhone(payload.phone);
  }
  if (Object.prototype.hasOwnProperty.call(payload, "role")) {
    out.role = parseOptionalRole(payload.role);
  }
  if (Object.prototype.hasOwnProperty.call(payload, "permissions")) {
    out.permissions = parsePermissions(payload.permissions, false);
  }

  return out;
}

/**
 * @param {unknown} err
 */
function rethrowDuplicateEmail(err) {
  if (err && typeof err === "object" && "code" in err && err.code === "23505") {
    throw Object.assign(new Error("A user with that email already exists"), {
      status: 409,
    });
  }
  throw err;
}

/**
 * @param {string} userId
 */
async function assertNotLastManageUsers(userId) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT permissions FROM users
     WHERE id = $1::uuid AND is_active = true`,
    [userId],
  );
  const perms = permissionsFromDb(rows[0]?.permissions);
  if (!perms.includes(PERMISSIONS.manageUsers)) return;

  const { rows: others } = await pool.query(
    `SELECT 1 FROM users
     WHERE is_active = true
       AND id <> $1::uuid
       AND $2 = ANY(permissions)
     LIMIT 1`,
    [userId, PERMISSIONS.manageUsers],
  );
  if (others.length === 0) {
    throw Object.assign(
      new Error("Cannot remove the only user with Manage users access"),
      { status: 403 },
    );
  }
}

/**
 * @param {Record<string, unknown> | null | undefined} body
 * @param {string} actorUserId
 */
export async function createUser(body, actorUserId) {
  await assertPermission(actorUserId, PERMISSIONS.manageUsers);

  const fields = parseUserBody(body, { requireDisplayName: true });
  const displayName = /** @type {string} */ (fields.displayName);
  const email =
    "email" in fields ? /** @type {string | null} */ (fields.email) : null;
  const phone =
    "phone" in fields ? /** @type {string | null} */ (fields.phone) : null;
  const role = "role" in fields ? /** @type {string} */ (fields.role) : "";
  const permissions =
    "permissions" in fields
      ? /** @type {string[]} */ (fields.permissions)
      : [];

  const pool = getPool();
  const customFields = await parseEntityCustomFields(
    pool,
    CUSTOM_FIELD_ENTITIES.user,
    body,
    { requireAll: true },
  );
  const id = randomUUID();
  try {
    const { rows } = await pool.query(
      `INSERT INTO users (id, display_name, email, phone, role, permissions, is_active, custom_fields)
       VALUES ($1::uuid, $2, $3, $4, $5, $6::text[], true, $7::jsonb)
       RETURNING ${USER_SELECT}`,
      [
        id,
        displayName,
        email,
        phone,
        role,
        permissions,
        JSON.stringify(customFields ?? {}),
      ],
    );
    return withEntityCustomFields(
      pool,
      CUSTOM_FIELD_ENTITIES.user,
      mapUserRow(rows[0]),
      rows[0].custom_fields,
    );
  } catch (err) {
    rethrowDuplicateEmail(err);
  }
}

/**
 * @param {string} userId
 * @param {Record<string, unknown> | null | undefined} body
 * @param {string} actorUserId
 */
export async function updateUser(userId, body, actorUserId) {
  const id = String(userId ?? "").trim();
  if (!id) {
    throw Object.assign(new Error("userId is required"), { status: 400 });
  }
  await assertPermission(actorUserId, PERMISSIONS.manageUsers);

  const payload = body && typeof body === "object" ? body : {};
  const fields = parseUserBody(payload);
  const pool = getPool();
  const customFields = await parseEntityCustomFields(
    pool,
    CUSTOM_FIELD_ENTITIES.user,
    payload,
  );
  const keys = Object.keys(fields);
  if (keys.length === 0 && customFields === undefined) {
    throw Object.assign(
      new Error(
        "displayName, email, phone, role, permissions, or customFields is required",
      ),
      { status: 400 },
    );
  }

  if ("permissions" in fields) {
    const permissionsValue = /** @type {string[]} */ (fields.permissions);
    if (
      wouldRemoveOwnManageUsers(
        String(actorUserId).trim(),
        id,
        permissionsValue,
      )
    ) {
      throw Object.assign(
        new Error("Cannot remove manage_users from yourself"),
        { status: 403 },
      );
    }
  }

  const sets = ["updated_at = now()"];
  const params = [];

  if ("displayName" in fields) {
    params.push(fields.displayName);
    sets.push(`display_name = $${params.length}`);
  }
  if ("email" in fields) {
    params.push(fields.email);
    sets.push(`email = $${params.length}`);
  }
  if ("phone" in fields) {
    params.push(fields.phone);
    sets.push(`phone = $${params.length}`);
  }
  if ("role" in fields) {
    params.push(fields.role);
    sets.push(`role = $${params.length}`);
  }
  if ("permissions" in fields) {
    params.push(fields.permissions);
    sets.push(`permissions = $${params.length}`);
  }
  if (customFields !== undefined) {
    params.push(JSON.stringify(customFields));
    sets.push(`custom_fields = $${params.length}::jsonb`);
  }

  params.push(id);
  try {
    const { rows } = await pool.query(
      `UPDATE users SET ${sets.join(", ")}
       WHERE id = $${params.length}::uuid AND is_active = true
       RETURNING ${USER_SELECT}`,
      params,
    );
    if (!rows[0]) {
      throw Object.assign(new Error("User not found"), { status: 404 });
    }
    return withEntityCustomFields(
      pool,
      CUSTOM_FIELD_ENTITIES.user,
      mapUserRow(rows[0]),
      rows[0].custom_fields,
    );
  } catch (err) {
    if (err && typeof err === "object" && "status" in err) throw err;
    rethrowDuplicateEmail(err);
  }
}

/**
 * @param {string} userId
 * @param {string} actorUserId
 */
export async function deactivateUser(userId, actorUserId) {
  const id = String(userId ?? "").trim();
  if (!id) {
    throw Object.assign(new Error("userId is required"), { status: 400 });
  }
  await assertPermission(actorUserId, PERMISSIONS.manageUsers);

  const actorId = String(actorUserId).trim();
  if (actorId === id) {
    throw Object.assign(new Error("Cannot deactivate your own account"), {
      status: 403,
    });
  }

  await assertNotLastManageUsers(id);

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `UPDATE users
       SET is_active = false, updated_at = now()
       WHERE id = $1::uuid AND is_active = true
       RETURNING id, display_name, email, phone, role, permissions`,
      [id],
    );
    if (!rows[0]) {
      throw Object.assign(new Error("User not found"), { status: 404 });
    }

    await client.query(
      `UPDATE mobile_devices
       SET revoked_at = now(),
           revoked_by_user_id = $2::uuid
       WHERE user_id = $1::uuid
         AND revoked_at IS NULL`,
      [id, actorId],
    );

    await client.query("COMMIT");
    return mapUserRow(rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
