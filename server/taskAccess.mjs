import { getPool } from "./db.mjs";
import { hasPermission, PERMISSIONS } from "../shared/permissions.js";
import { getUserPermissions } from "./permissions.mjs";

/**
 * @param {string} userId
 * @returns {Promise<boolean>}
 */
export async function userCanViewAllTasks(userId) {
  const permissions = await getUserPermissions(userId);
  return hasPermission(permissions, PERMISSIONS.viewAllTasks);
}

/**
 * @param {string} userId
 * @param {number} taskId
 * @returns {Promise<boolean>}
 */
export async function isUserAssignedToTask(userId, taskId) {
  const id = String(userId ?? "").trim();
  if (!id || !Number.isInteger(taskId) || taskId < 1) return false;
  const pool = getPool();
  const { rowCount } = await pool.query(
    `SELECT 1 FROM task_crew_members WHERE task_id = $1 AND user_id = $2::uuid`,
    [taskId, id],
  );
  return rowCount > 0;
}

/**
 * @param {string} userId
 * @param {number} taskId
 */
export async function assertUserAssignedToTask(userId, taskId) {
  if (!(await isUserAssignedToTask(userId, taskId))) {
    throw Object.assign(new Error("User is not assigned to this task"), {
      status: 403,
    });
  }
}

/**
 * Assigned crew, task creator, or `view_all_tasks`.
 * @param {string} userId
 * @param {number} taskId
 * @returns {Promise<boolean>}
 */
export async function isUserAllowedToViewTask(userId, taskId) {
  const id = String(userId ?? "").trim();
  if (!id || !Number.isInteger(taskId) || taskId < 1) return false;
  if (await userCanViewAllTasks(id)) return true;
  if (await isUserAssignedToTask(id, taskId)) return true;
  const pool = getPool();
  const { rowCount } = await pool.query(
    `SELECT 1
     FROM tasks
     WHERE id = $1
       AND created_by_user_id = $2::uuid
       AND deleted_at IS NULL`,
    [taskId, id],
  );
  return rowCount > 0;
}

/**
 * @param {string} userId
 * @param {number} taskId
 */
export async function assertUserCanViewTask(userId, taskId) {
  if (!(await isUserAllowedToViewTask(userId, taskId))) {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }
}
