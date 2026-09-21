import { formatPushDateTime } from "./crewPushNotifications.js";

/**
 * @param {string | null | undefined} iso
 * @returns {string | null}
 */
function normalizeIso(iso) {
  if (iso == null || iso === "") return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/**
 * @param {string | null | undefined} a
 * @param {string | null | undefined} b
 */
function isoEqual(a, b) {
  return normalizeIso(a) === normalizeIso(b);
}

/**
 * @param {string | null | undefined} value
 */
function formatScheduleValue(value) {
  const iso = normalizeIso(value);
  if (!iso) return "none";
  return formatPushDateTime(iso) || iso;
}

/**
 * @param {string | null | undefined} value
 */
function normText(value) {
  if (value == null) return null;
  const t = String(value).trim();
  return t.length > 0 ? t : null;
}

/**
 * @param {unknown} value
 * @returns {string[]}
 */
function normIdList(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((id) => String(id)).filter(Boolean))].sort();
}

/**
 * @param {Record<string, unknown>} fields
 */
function stableCustomFieldsJson(fields) {
  const keys = Object.keys(fields).sort((a, b) => Number(a) - Number(b));
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const key of keys) {
    out[key] = fields[key];
  }
  return JSON.stringify(out);
}

/**
 * @typedef {object} TaskEditSnapshot
 * @property {string} status
 * @property {string} taskType
 * @property {string | null} description
 * @property {string | null} jobTitle
 * @property {string | null} externalKey
 * @property {number | null} destinationAddressId
 * @property {string | null} destinationAddressName
 * @property {string | null} destinationAddress
 * @property {string | null} destinationBuilding
 * @property {string | null} destinationNotes
 * @property {string | null} windowStartAt
 * @property {string | null} windowEndAt
 * @property {string[]} contactIds
 * @property {string[]} crewMemberIds
 * @property {Record<string, unknown>} customFields
 */

/**
 * Human-readable lines for task history (one save may produce several).
 *
 * @param {TaskEditSnapshot} before
 * @param {TaskEditSnapshot} after
 * @returns {string[]}
 */
export function summarizeTaskEditChanges(before, after) {
  /** @type {string[]} */
  const lines = [];

  if (!isoEqual(before.windowStartAt, after.windowStartAt)) {
    lines.push(
      `Start: ${formatScheduleValue(before.windowStartAt)} → ${formatScheduleValue(after.windowStartAt)}`,
    );
  }
  if (!isoEqual(before.windowEndAt, after.windowEndAt)) {
    lines.push(
      `Finish by: ${formatScheduleValue(before.windowEndAt)} → ${formatScheduleValue(after.windowEndAt)}`,
    );
  }

  if (before.status !== after.status) {
    lines.push(`Status: ${before.status} → ${after.status}`);
  }
  if (before.taskType !== after.taskType) {
    lines.push(`Task type: ${before.taskType} → ${after.taskType}`);
  }

  if (normText(before.jobTitle) !== normText(after.jobTitle)) {
    lines.push(
      `Title: ${normText(before.jobTitle) ?? "none"} → ${normText(after.jobTitle) ?? "none"}`,
    );
  }
  if (normText(before.externalKey) !== normText(after.externalKey)) {
    lines.push(
      `External key: ${normText(before.externalKey) ?? "none"} → ${normText(after.externalKey) ?? "none"}`,
    );
  }
  if (normText(before.description) !== normText(after.description)) {
    lines.push("Description updated");
  }

  const destFields = [
    ["Destination", before.destinationAddressName, after.destinationAddressName],
    ["Address", before.destinationAddress, after.destinationAddress],
    ["Building", before.destinationBuilding, after.destinationBuilding],
    ["Destination notes", before.destinationNotes, after.destinationNotes],
  ];
  for (const [label, prev, next] of destFields) {
    if (normText(prev) !== normText(next)) {
      lines.push(`${label}: ${normText(prev) ?? "none"} → ${normText(next) ?? "none"}`);
    }
  }
  if (before.destinationAddressId !== after.destinationAddressId) {
    lines.push("Linked venue updated");
  }

  if (normIdList(before.contactIds).join(",") !== normIdList(after.contactIds).join(",")) {
    lines.push("Contacts updated");
  }
  if (
    normIdList(before.crewMemberIds).join(",") !==
    normIdList(after.crewMemberIds).join(",")
  ) {
    lines.push("Crew assignment updated");
  }

  if (
    stableCustomFieldsJson(before.customFields) !==
    stableCustomFieldsJson(after.customFields)
  ) {
    lines.push("Custom fields updated");
  }

  return lines;
}
