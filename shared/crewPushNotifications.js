/** @typedef {'task_assigned' | 'task_unassigned' | 'task_cancelled' | 'schedule_changed' | 'task_details_changed'} CrewPushNotificationId */

const CREW_PUSH_TIME_ZONE = "America/Los_Angeles";

/**
 * @param {string | null | undefined} iso
 * @returns {{ day: string, shortDate: string } | null}
 */
export function taskDayFromWindowStart(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CREW_PUSH_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  if (!y || !m || !day) return null;
  const dayKey = `${y}-${m}-${day}`;
  const shortDate = `${Number(m)}/${Number(day)}`;
  return { day: dayKey, shortDate };
}

/**
 * @param {string | null | undefined} iso
 * @returns {string}
 */
export function formatPushDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: CREW_PUSH_TIME_ZONE,
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .format(d)
    .replace(/\s/g, "")
    .replace(",", " ")
    .toLowerCase();
}

/**
 * @param {string | null | undefined} name
 * @param {string | null | undefined} street
 */
export function formatPushVenue(name, street) {
  const n = String(name ?? "").trim();
  const s = String(street ?? "").trim();
  if (n && s && n !== s) return `@ ${n} - ${s}`;
  if (n) return `@ ${n}`;
  if (s) return `@ ${s}`;
  return "";
}

/**
 * @param {number} taskId
 * @param {string | null | undefined} externalKey
 */
export function formatTaskRef(taskId, externalKey) {
  const key = String(externalKey ?? "").trim();
  return key ? key : String(taskId);
}

/**
 * @param {{
 *   notificationId: CrewPushNotificationId;
 *   taskId: number;
 *   externalKey?: string | null;
 *   windowStartAt?: string | null;
 *   windowEndAt?: string | null;
 *   destinationName?: string | null;
 *   destinationAddress?: string | null;
 *   prevWindowStartAt?: string | null;
 *   detailLine?: string | null;
 * }} input
 */
export function buildCrewPushPayload(input) {
  const taskRef = formatTaskRef(input.taskId, input.externalKey);
  const dayInfo = taskDayFromWindowStart(input.windowStartAt);
  const day = dayInfo?.day ?? "";
  const shortDate = dayInfo?.shortDate ?? "";
  const venue = formatPushVenue(
    input.destinationName,
    input.destinationAddress,
  );
  const venueSuffix = venue ? ` ${venue}` : "";

  /** @type {string} */
  let title;
  /** @type {string} */
  let body;

  switch (input.notificationId) {
    case "task_assigned":
      title = `Assigned to task #${taskRef}${shortDate ? ` - ${shortDate}` : ""}`;
      body = `${formatPushDateTime(input.windowStartAt) || shortDate || "Task"}${venueSuffix}`.trim();
      break;
    case "task_unassigned":
      title = `Removed from task #${taskRef}${shortDate ? ` - ${shortDate}` : ""}`;
      body = `Removed from task${venueSuffix}`.trim();
      break;
    case "task_cancelled":
      title = `Task cancelled #${taskRef}${shortDate ? ` - ${shortDate}` : ""}`;
      body = `Task cancelled${venueSuffix}`.trim();
      break;
    case "schedule_changed": {
      title = `Schedule changed #${taskRef}${shortDate ? ` - ${shortDate}` : ""}`;
      const before = formatPushDateTime(input.prevWindowStartAt);
      const after = formatPushDateTime(input.windowStartAt);
      body =
        before && after
          ? `Window Start ${before} -> ${after}`
          : `Schedule updated${venueSuffix}`.trim();
      break;
    }
    case "task_details_changed":
      title = `Task details changed #${taskRef}${shortDate ? ` - ${shortDate}` : ""}`;
      body = String(input.detailLine ?? "").trim() || `Task updated${venueSuffix}`.trim();
      break;
    default:
      title = "Task update";
      body = venueSuffix.trim() || "Open Field for details";
  }

  return {
    title,
    body,
    data: {
      notificationId: input.notificationId,
      taskId: String(input.taskId),
      ...(day ? { day } : {}),
    },
  };
}

/**
 * @param {string | null | undefined} a
 * @param {string | null | undefined} b
 */
function isoEqual(a, b) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return new Date(a).getTime() === new Date(b).getTime();
}

/**
 * One notification per user per save (priority: unassigned > assigned > schedule > details).
 *
 * @param {{
 *   prevCrewIds: string[];
 *   nextCrewIds: string[];
 *   scheduleChanged: boolean;
 *   crewCompositionChanged: boolean;
 *   detailLine?: string | null;
 * }} diff
 * @returns {Map<string, CrewPushNotificationId>}
 */
export function crewPushIdsPerUser(diff) {
  const prev = new Set(diff.prevCrewIds);
  const next = new Set(diff.nextCrewIds);
  const out = new Map();

  for (const id of prev) {
    if (!next.has(id)) out.set(id, "task_unassigned");
  }
  for (const id of next) {
    if (!prev.has(id)) out.set(id, "task_assigned");
  }
  for (const id of next) {
    if (prev.has(id) && !out.has(id)) {
      if (diff.scheduleChanged) {
        out.set(id, "schedule_changed");
      } else if (diff.crewCompositionChanged) {
        out.set(id, "task_details_changed");
      }
    }
  }

  return out;
}

/**
 * @param {string | null | undefined} prevStart
 * @param {string | null | undefined} nextStart
 * @param {string | null | undefined} prevEnd
 * @param {string | null | undefined} nextEnd
 */
export function taskScheduleChanged(prevStart, nextStart, prevEnd, nextEnd) {
  return (
    !isoEqual(prevStart, nextStart) || !isoEqual(prevEnd, nextEnd)
  );
}

/**
 * @param {string[]} prevCrewIds
 * @param {string[]} nextCrewIds
 */
export function crewCompositionChanged(prevCrewIds, nextCrewIds) {
  if (prevCrewIds.length !== nextCrewIds.length) return true;
  const prev = new Set(prevCrewIds);
  for (const id of nextCrewIds) {
    if (!prev.has(id)) return true;
  }
  return false;
}
