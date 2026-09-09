import { getPool } from "./db.mjs";
import {
  ALL_PERMISSIONS,
  PERMISSIONS,
  hasPermission,
  permissionsFromDb,
} from "../shared/permissions.js";

export { ALL_PERMISSIONS, PERMISSIONS };

/**
 * @param {string} actorUserId
 * @param {string} key
 */
export async function assertPermission(actorUserId, key) {
  const id = String(actorUserId ?? "").trim();
  if (!id) {
    throw Object.assign(new Error("actorUserId is required"), { status: 400 });
  }
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT permissions FROM users WHERE id = $1::uuid AND is_active = true`,
    [id],
  );
  if (!hasPermission(permissionsFromDb(rows[0]?.permissions), key)) {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }
}

/**
 * @param {string} key
 * @returns {Promise<boolean>}
 */
/**
 * @param {string} userId
 * @returns {Promise<string[]>}
 */
export async function getUserPermissions(userId) {
  const id = String(userId ?? "").trim();
  if (!id) return [];
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT permissions FROM users WHERE id = $1::uuid AND is_active = true`,
    [id],
  );
  return permissionsFromDb(rows[0]?.permissions);
}

export async function anyUserHasPermission(key) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT 1 FROM users
     WHERE is_active = true AND $1 = ANY(permissions)
     LIMIT 1`,
    [key],
  );
  return rows.length > 0;
}
