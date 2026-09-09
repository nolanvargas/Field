import { getPool } from "../db.mjs";
import {
  ALL_PERMISSIONS,
  PERMISSIONS,
  anyUserHasPermission,
} from "../permissions.mjs";
import { mapUserRow } from "../users.mjs";

/**
 * @typedef {{
 *   subjectId: string,
 *   email: string | null,
 *   name: string | null,
 *   displayNameFallback?: string,
 * }} VerifiedIdentity
 */

/**
 * Upsert users row from a verified identity provider subject. New users get an
 * empty role label and no extra permissions. If nobody has `manage_users` yet,
 * the first insert is granted all extra keys. If email already exists under a
 * different id (imported user), link to that row instead of inserting twice.
 * @param {VerifiedIdentity} identity
 */
export async function upsertUserFromVerifiedIdentity(identity) {
  const pool = getPool();
  const displayName =
    (identity.name && identity.name.trim()) ||
    (identity.email && identity.email.trim()) ||
    identity.displayNameFallback ||
    "User";

  const byId = await pool.query(
    `SELECT id, display_name, role, permissions FROM users WHERE id = $1::uuid`,
    [identity.subjectId],
  );
  if (byId.rows[0]) {
    const { rows } = await pool.query(
      `UPDATE users SET
         display_name = $2,
         email = COALESCE($3, email),
         updated_at = now(),
         is_active = true
       WHERE id = $1::uuid
       RETURNING id, display_name, role, permissions`,
      [identity.subjectId, displayName, identity.email],
    );
    return mapUserRow(rows[0]);
  }

  if (identity.email) {
    const byEmail = await pool.query(
      `SELECT id, display_name, role, permissions FROM users WHERE lower(email) = lower($1)`,
      [identity.email],
    );
    if (byEmail.rows[0]) {
      const { rows } = await pool.query(
        `UPDATE users SET
           display_name = $2,
           updated_at = now(),
           is_active = true
         WHERE id = $1::uuid
         RETURNING id, display_name, role, permissions`,
        [byEmail.rows[0].id, displayName],
      );
      return mapUserRow(rows[0]);
    }
  }

  const bootstrap = !(await anyUserHasPermission(PERMISSIONS.manageUsers));
  const permissions = bootstrap ? [...ALL_PERMISSIONS] : [];

  const { rows } = await pool.query(
    `INSERT INTO users (id, display_name, email, role, permissions, is_active)
     VALUES ($1::uuid, $2, $3, '', $4::text[], true)
     RETURNING id, display_name, role, permissions`,
    [identity.subjectId, displayName, identity.email, permissions],
  );

  return mapUserRow(rows[0]);
}
