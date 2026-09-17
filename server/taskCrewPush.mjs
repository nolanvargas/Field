/**
 * Server-driven crew push notifications (assign, cancel, schedule, etc.).
 */

import { getPool } from "./db.mjs";
import {
  buildCrewPushPayload,
  crewCompositionChanged,
  crewPushIdsPerUser,
  taskScheduleChanged,
} from "../shared/crewPushNotifications.js";
import { isInvalidFcmTokenError, sendPushToDevice } from "./push.mjs";

/**
 * @param {number} taskId
 */
export async function loadTaskPushContext(taskId) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT t.id,
            t.external_key,
            t.window_start_at,
            t.window_end_at,
            COALESCE(t.destination_address_name, '') AS destination_name,
            COALESCE(t.destination_address, '') AS destination_address,
            COALESCE(
              array_agg(tcm.user_id::text) FILTER (WHERE tcm.user_id IS NOT NULL),
              '{}'
            ) AS crew_ids
     FROM tasks t
     LEFT JOIN task_crew_members tcm ON tcm.task_id = t.id
     WHERE t.id = $1
       AND t.deleted_at IS NULL
     GROUP BY t.id`,
    [taskId],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    taskId: Number(row.id),
    externalKey: row.external_key ?? null,
    windowStartAt: row.window_start_at
      ? new Date(row.window_start_at).toISOString()
      : null,
    windowEndAt: row.window_end_at
      ? new Date(row.window_end_at).toISOString()
      : null,
    destinationName: row.destination_name ?? "",
    destinationAddress: row.destination_address ?? "",
    crewIds: Array.isArray(row.crew_ids) ? row.crew_ids.map(String) : [],
  };
}

/**
 * @param {string[]} userIds
 */
async function loadActiveDeviceTokens(userIds) {
  if (userIds.length === 0) return [];
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT id, user_id, push_token
     FROM mobile_devices
     WHERE user_id = ANY($1::uuid[])
       AND revoked_at IS NULL
       AND push_token IS NOT NULL
       AND push_token <> ''`,
    [userIds],
  );
  return rows.map((row) => ({
    deviceId: String(row.id),
    userId: String(row.user_id),
    token: String(row.push_token),
  }));
}

/**
 * @param {string} deviceId
 */
async function clearDevicePushToken(deviceId) {
  const pool = getPool();
  await pool.query(
    `UPDATE mobile_devices
     SET push_token = NULL,
         push_token_updated_at = now()
     WHERE id = $1::uuid`,
    [deviceId],
  );
}

/**
 * @param {string} userId
 * @param {import('../shared/crewPushNotifications.js').CrewPushNotificationId} notificationId
 * @param {{
 *   taskId: number;
 *   externalKey?: string | null;
 *   windowStartAt?: string | null;
 *   windowEndAt?: string | null;
 *   destinationName?: string | null;
 *   destinationAddress?: string | null;
 *   prevWindowStartAt?: string | null;
 *   detailLine?: string | null;
 * }} taskCtx
 */
async function sendCrewPushToUser(userId, notificationId, taskCtx) {
  const devices = await loadActiveDeviceTokens([userId]);
  if (devices.length === 0) return;

  const { title, body, data } = buildCrewPushPayload({
    notificationId,
    ...taskCtx,
  });

  for (const device of devices) {
    try {
      await sendPushToDevice({
        token: device.token,
        title,
        body,
        data,
      });
    } catch (err) {
      if (isInvalidFcmTokenError(err)) {
        await clearDevicePushToken(device.deviceId);
        continue;
      }
      console.error(
        `[taskCrewPush] send failed task=${taskCtx.taskId} user=${userId}:`,
        err,
      );
    }
  }
}

/**
 * @param {number} taskId
 */
export async function notifyTaskCancelled(taskId) {
  const ctx = await loadTaskPushContext(taskId);
  if (!ctx) return;
  const jobs = ctx.crewIds.map((userId) =>
    sendCrewPushToUser(userId, "task_cancelled", ctx),
  );
  await Promise.all(jobs);
}

/**
 * @param {number} taskId
 * @param {string[]} crewMemberIds
 */
export async function notifyTaskAssigned(taskId, crewMemberIds) {
  const ctx = await loadTaskPushContext(taskId);
  if (!ctx) return;
  const jobs = crewMemberIds.map((userId) =>
    sendCrewPushToUser(userId, "task_assigned", ctx),
  );
  await Promise.all(jobs);
}

/**
 * @param {number} taskId
 * @param {{
 *   prevCrewIds: string[];
 *   nextCrewIds: string[];
 *   prevWindowStartAt: string | null;
 *   prevWindowEndAt: string | null;
 *   detailLine?: string | null;
 * }} diff
 */
export async function notifyTaskUpdated(taskId, diff) {
  const ctx = await loadTaskPushContext(taskId);
  if (!ctx) return;

  const scheduleChanged = taskScheduleChanged(
    diff.prevWindowStartAt,
    ctx.windowStartAt,
    diff.prevWindowEndAt,
    ctx.windowEndAt,
  );
  const compositionChanged = crewCompositionChanged(
    diff.prevCrewIds,
    diff.nextCrewIds,
  );

  const perUser = crewPushIdsPerUser({
    prevCrewIds: diff.prevCrewIds,
    nextCrewIds: diff.nextCrewIds,
    scheduleChanged,
    crewCompositionChanged: compositionChanged,
    detailLine: diff.detailLine,
  });

  const jobs = [];
  for (const [userId, notificationId] of perUser) {
    jobs.push(
      sendCrewPushToUser(userId, notificationId, {
        ...ctx,
        prevWindowStartAt: diff.prevWindowStartAt,
        detailLine: diff.detailLine,
      }),
    );
  }
  await Promise.all(jobs);
}
