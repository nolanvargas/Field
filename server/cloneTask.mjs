import { listAttachments } from "./attachments.mjs";
import { createTask } from "./createTask.mjs";
import { getPool } from "./db.mjs";
import {
  buildAttachmentStorageKey,
  copyObject,
} from "./storage.mjs";

/**
 * @param {unknown} value
 * @param {boolean} defaultValue
 */
function asBoolDefault(value, defaultValue) {
  if (value === undefined || value === null) return defaultValue;
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return defaultValue;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function asString(value) {
  if (value == null) return "";
  return String(value).trim();
}

/**
 * Clone a task with optional contacts, crew, dates, attachments, and external key.
 *
 * @param {number} sourceTaskId
 * @param {Record<string, unknown>} body
 */
export async function cloneTask(sourceTaskId, body) {
  if (!Number.isInteger(sourceTaskId) || sourceTaskId < 1) {
    throw Object.assign(new Error("Invalid task id"), { status: 400 });
  }

  const createdByUserId = asString(body.createdByUserId);
  if (!createdByUserId) {
    throw Object.assign(new Error("createdByUserId is required"), {
      status: 400,
    });
  }

  const includeContacts = asBoolDefault(body.includeContacts, true);
  const includeCrew = asBoolDefault(body.includeCrew, true);
  const includeDates = asBoolDefault(body.includeDates, true);
  const includeAttachments = asBoolDefault(body.includeAttachments, true);
  const includeExternalKey = asBoolDefault(body.includeExternalKey, false);

  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT
       t.id,
       t.task_type,
       t.task_type_id,
       t.description,
       t.job_title,
       t.external_key,
       t.custom_fields,
       t.custom_field_defs_snapshot,
       t.window_start_at,
       t.window_end_at,
       t.destination_address_id,
       t.destination_address_name,
       t.destination_address,
       t.destination_building,
       t.destination_notes,
       (
         SELECT coalesce(
           json_agg(
             json_build_object(
               'id', c.id,
               'isPoc', tc.is_poc,
               'receivesEmail', tc.receives_email
             )
             ORDER BY tc.is_poc DESC, c.name
           ),
           '[]'::json
         )
         FROM task_contacts tc
         JOIN contacts c ON c.id = tc.contact_id
         WHERE tc.task_id = t.id
           AND c.deleted_at IS NULL
       ) AS contacts,
       (
         SELECT coalesce(
           json_agg(
             json_build_object(
               'id', u.id::text,
               'isLead', tcm.is_lead
             )
             ORDER BY tcm.is_lead DESC, u.display_name
           ),
           '[]'::json
         )
         FROM task_crew_members tcm
         JOIN users u ON u.id = tcm.user_id
         WHERE tcm.task_id = t.id
           AND u.is_active = true
       ) AS crew_members
     FROM tasks t
     WHERE t.id = $1
       AND t.deleted_at IS NULL`,
    [sourceTaskId],
  );

  if (rows.length === 0) {
    throw Object.assign(new Error("Task not found"), { status: 404 });
  }

  const source = rows[0];
  /** @type {{ id: number, isPoc: boolean, receivesEmail: boolean }[]} */
  const contacts = Array.isArray(source.contacts) ? source.contacts : [];
  /** @type {{ id: string, isLead: boolean }[]} */
  const crewMembers = Array.isArray(source.crew_members)
    ? source.crew_members
    : [];

  const contactIds = includeContacts
    ? contacts.map((c) => Number(c.id)).filter((id) => Number.isInteger(id) && id > 0)
    : [];
  const pocFromSource = contacts.find((c) => c.isPoc);
  const pocContactId = includeContacts
    ? (pocFromSource != null
        ? Number(pocFromSource.id)
        : (contactIds[0] ?? null))
    : null;
  const receiveEmailContactIds = includeContacts
    ? contacts.filter((c) => c.receivesEmail).map((c) => Number(c.id))
    : [];

  const crewMemberIds = includeCrew
    ? [
        ...new Set(
          crewMembers.map((m) => String(m.id)).filter(Boolean),
        ),
      ]
    : [];
  const leadFromSource = crewMembers.find((m) => m.isLead);
  const leadCrewMemberId = includeCrew
    ? (leadFromSource?.id ?? crewMemberIds[0] ?? null)
    : null;

  /** @type {Record<string, unknown>} */
  const createBody = {
    createdByUserId,
    taskTypeId:
      source.task_type_id != null ? Number(source.task_type_id) : undefined,
    taskType: source.task_type,
    allowRetiredTaskType: true,
    taskDesc: source.description ?? "",
    jobTitle: source.job_title ?? "",
    externalKey: includeExternalKey ? (source.external_key ?? "") : "",
    destinationAddressId:
      source.destination_address_id != null
        ? Number(source.destination_address_id)
        : null,
    destinationAddressName: source.destination_address_name ?? "",
    destinationAddress: source.destination_address ?? "",
    destinationBuilding: source.destination_building ?? "",
    destinationNotes: source.destination_notes ?? "",
    contactIds,
    pocContactId,
    receiveEmailContactIds,
    crewMemberIds,
    leadCrewMemberId,
    afterDateTime:
      includeDates && source.window_start_at
        ? new Date(source.window_start_at).toISOString()
        : "",
    beforeDateTime:
      includeDates && source.window_end_at
        ? new Date(source.window_end_at).toISOString()
        : "",
    customFields:
      source.custom_fields &&
      typeof source.custom_fields === "object" &&
      !Array.isArray(source.custom_fields)
        ? source.custom_fields
        : {},
    customFieldDefsSnapshot: source.custom_field_defs_snapshot ?? [],
  };

  const created = await createTask(createBody);

  if (includeAttachments) {
    const attachments = await listAttachments(sourceTaskId);
    for (const att of attachments) {
      const fileName = att.fileName || "file";
      const destKey = buildAttachmentStorageKey(created.id, fileName);
      try {
        await copyObject(att.storageKey, destKey);
        await pool.query(
          `INSERT INTO task_attachments (
             task_id,
             uploaded_by_user_id,
             kind,
             storage_key,
             mime_type,
             file_name,
             file_size_bytes,
             caption
           ) VALUES ($1, $2::uuid, $3, $4, $5, $6, $7, $8)`,
          [
            created.id,
            createdByUserId,
            att.kind,
            destKey,
            att.mimeType,
            fileName,
            att.fileSizeBytes,
            att.caption,
          ],
        );
      } catch (err) {
        console.error(
          `Failed to copy attachment ${att.id} while cloning task ${sourceTaskId} → ${created.id}:`,
          err,
        );
      }
    }
  }

  return created;
}
