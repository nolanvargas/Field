import { getPool } from "./db.mjs";
import {
  buildAttachmentStorageKey,
  deleteObject,
  isS3Enabled,
  isValidAttachmentKeyForTask,
  localObjectExists,
  presignGet,
  presignPut,
  sanitizeFileName,
} from "./storage.mjs";
import {
  ALLOWED_MIME_TYPES,
  kindFromMimeType,
  maxBytesForMimeType,
  normalizeMimeType,
  oversizeErrorMessage,
} from "../shared/attachments.js";
import {
  assertAttachmentTypeAllowsMime,
  loadActiveAttachmentTypeById,
  parseOptionalAttachmentTypeId,
} from "./attachmentTypes.mjs";
import { recordTaskHistoryEvent } from "./taskHistory.mjs";

// Keep the names this module previously exported available to importers.
export {
  ALLOWED_MIME_TYPES,
  MAX_ATTACHMENT_BYTES,
  MAX_VIDEO_ATTACHMENT_BYTES,
  isVideoMimeType,
  kindFromMimeType,
  maxBytesForMimeType,
  normalizeMimeType,
  oversizeErrorMessage,
} from "../shared/attachments.js";

/**
 * @param {import('pg').QueryResultRow} row
 */
const ATTACHMENT_SELECT = `
       a.id,
       a.task_id,
       a.kind,
       a.storage_key,
       a.mime_type,
       a.file_name,
       a.file_size_bytes,
       a.caption,
       a.created_at,
       a.uploaded_by_user_id,
       a.attachment_type_id,
       u.display_name AS uploaded_by_name,
       tat.slug AS attachment_type_slug,
       tat.label AS attachment_type_label`;

function mapAttachmentRow(row) {
  return {
    id: Number(row.id),
    taskId: Number(row.task_id),
    kind: row.kind,
    storageKey: row.storage_key,
    mimeType: row.mime_type,
    fileName: row.file_name ?? null,
    fileSizeBytes:
      row.file_size_bytes != null ? Number(row.file_size_bytes) : null,
    caption: row.caption ?? null,
    createdAt: new Date(row.created_at).toISOString(),
    uploadedByUserId: String(row.uploaded_by_user_id),
    uploadedByName: row.uploaded_by_name ?? null,
    attachmentTypeId:
      row.attachment_type_id != null ? Number(row.attachment_type_id) : null,
    attachmentTypeSlug: row.attachment_type_slug ?? null,
    attachmentTypeLabel: row.attachment_type_label ?? null,
  };
}

/**
 * @param {number} taskId
 */
export async function assertTaskExists(taskId) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT id FROM tasks WHERE id = $1 AND deleted_at IS NULL`,
    [taskId],
  );
  if (rows.length === 0) {
    throw Object.assign(new Error("Task not found"), { status: 404 });
  }
}

/**
 * @param {number} taskId
 */
export async function listAttachments(taskId) {
  await assertTaskExists(taskId);
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT ${ATTACHMENT_SELECT}
     FROM task_attachments a
     LEFT JOIN users u ON u.id = a.uploaded_by_user_id
     LEFT JOIN org_attachment_type_defs tat ON tat.id = a.attachment_type_id
     WHERE a.task_id = $1
     ORDER BY a.created_at ASC, a.id ASC`,
    [taskId],
  );
  return rows.map(mapAttachmentRow);
}

/**
 * @param {number} taskId
 * @param {number} attachmentId
 */
async function getAttachmentRow(taskId, attachmentId) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT ${ATTACHMENT_SELECT}
     FROM task_attachments a
     LEFT JOIN users u ON u.id = a.uploaded_by_user_id
     LEFT JOIN org_attachment_type_defs tat ON tat.id = a.attachment_type_id
     WHERE a.id = $1 AND a.task_id = $2`,
    [attachmentId, taskId],
  );
  return rows[0] ?? null;
}

/**
 * @param {unknown} body
 */
function requireString(body, key) {
  if (!body || typeof body !== "object") {
    throw Object.assign(new Error("Invalid JSON body"), { status: 400 });
  }
  const value = /** @type {Record<string, unknown>} */ (body)[key];
  if (typeof value !== "string" || !value.trim()) {
    throw Object.assign(new Error(`Missing or invalid ${key}`), {
      status: 400,
    });
  }
  return value.trim();
}

/**
 * @param {number} taskId
 * @param {unknown} body
 * @param {string} uploadedByUserId session-bound uploader (dev stub may fall back via route)
 */
export async function createPresign(taskId, body, uploadedByUserId) {
  await assertTaskExists(taskId);

  const fileName = sanitizeFileName(requireString(body, "fileName"));
  const mimeType = normalizeMimeType(requireString(body, "mimeType"));
  if (typeof uploadedByUserId !== "string" || !uploadedByUserId.trim()) {
    throw Object.assign(new Error("Missing or invalid uploadedByUserId"), {
      status: 400,
    });
  }
  const uploaderId = uploadedByUserId.trim();

  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw Object.assign(new Error(`Unsupported file type: ${mimeType}`), {
      status: 400,
    });
  }

  const rawSize =
    body && typeof body === "object"
      ? /** @type {Record<string, unknown>} */ (body).fileSizeBytes
      : undefined;
  const fileSizeBytes =
    typeof rawSize === "number"
      ? rawSize
      : typeof rawSize === "string"
        ? Number(rawSize)
        : NaN;
  if (!Number.isFinite(fileSizeBytes) || fileSizeBytes <= 0) {
    throw Object.assign(new Error("Missing or invalid fileSizeBytes"), {
      status: 400,
    });
  }
  const maxBytes = maxBytesForMimeType(mimeType);
  if (fileSizeBytes > maxBytes) {
    throw Object.assign(new Error(oversizeErrorMessage(mimeType, maxBytes)), {
      status: 400,
    });
  }

  const pool = getPool();
  const attachmentTypeId = parseOptionalAttachmentTypeId(body);
  await assertAttachmentTypeAllowsMime(pool, attachmentTypeId, mimeType);

  const userCheck = await pool.query(
    `SELECT id FROM users WHERE id = $1::uuid AND is_active = true`,
    [uploaderId],
  );
  if (userCheck.rows.length === 0) {
    throw Object.assign(new Error("Uploader user not found"), { status: 400 });
  }

  const storageKey = buildAttachmentStorageKey(taskId, fileName);
  const { uploadUrl } = await presignPut({ storageKey, mimeType });

  return {
    uploadUrl,
    storageKey,
    fileName,
    mimeType,
    fileSizeBytes,
    kind: kindFromMimeType(mimeType),
    uploadedByUserId: uploaderId,
  };
}

/**
 * @param {number} taskId
 * @param {unknown} body
 * @param {string} uploadedByUserId session-bound uploader (dev stub may fall back via route)
 */
export async function confirmAttachment(taskId, body, uploadedByUserId) {
  await assertTaskExists(taskId);

  const storageKey = requireString(body, "storageKey");
  if (!isValidAttachmentKeyForTask(taskId, storageKey)) {
    throw Object.assign(new Error("Invalid storageKey for task"), {
      status: 400,
    });
  }

  if (!isS3Enabled()) {
    const exists = await localObjectExists(storageKey);
    if (!exists) {
      throw Object.assign(new Error("Upload not found — complete the file upload first"), {
        status: 400,
      });
    }
  }

  const fileName = sanitizeFileName(requireString(body, "fileName"));
  const mimeType = normalizeMimeType(requireString(body, "mimeType"));
  if (typeof uploadedByUserId !== "string" || !uploadedByUserId.trim()) {
    throw Object.assign(new Error("Missing or invalid uploadedByUserId"), {
      status: 400,
    });
  }
  const uploaderId = uploadedByUserId.trim();

  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw Object.assign(new Error(`Unsupported file type: ${mimeType}`), {
      status: 400,
    });
  }

  const rawSize =
    body && typeof body === "object"
      ? /** @type {Record<string, unknown>} */ (body).fileSizeBytes
      : undefined;
  const fileSizeBytes =
    typeof rawSize === "number"
      ? rawSize
      : typeof rawSize === "string"
        ? Number(rawSize)
        : NaN;
  if (!Number.isFinite(fileSizeBytes) || fileSizeBytes <= 0) {
    throw Object.assign(new Error("Missing or invalid fileSizeBytes"), {
      status: 400,
    });
  }
  const maxBytes = maxBytesForMimeType(mimeType);
  if (fileSizeBytes > maxBytes) {
    throw Object.assign(new Error(oversizeErrorMessage(mimeType, maxBytes)), {
      status: 400,
    });
  }

  const captionRaw =
    body && typeof body === "object"
      ? /** @type {Record<string, unknown>} */ (body).caption
      : undefined;
  const caption =
    typeof captionRaw === "string" && captionRaw.trim()
      ? captionRaw.trim().slice(0, 2000)
      : null;

  const attachmentTypeId = parseOptionalAttachmentTypeId(body);
  const pool = getPool();
  await assertAttachmentTypeAllowsMime(pool, attachmentTypeId, mimeType);

  const kind = kindFromMimeType(mimeType);

  try {
    const { rows } = await pool.query(
      `INSERT INTO task_attachments (
         task_id,
         uploaded_by_user_id,
         kind,
         storage_key,
         mime_type,
         file_name,
         file_size_bytes,
         caption,
         attachment_type_id
       ) VALUES ($1, $2::uuid, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        taskId,
        uploaderId,
        kind,
        storageKey,
        mimeType,
        fileName,
        Math.round(fileSizeBytes),
        caption,
        attachmentTypeId,
      ],
    );

    const insertedId = Number(rows[0].id);
    const row = await getAttachmentRow(taskId, insertedId);
    if (!row) {
      throw Object.assign(new Error("Failed to load attachment"), { status: 500 });
    }
    return mapAttachmentRow(row);
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err
        ? String(err.code)
        : "";
    if (code === "23503") {
      throw Object.assign(new Error("Uploader user not found"), {
        status: 400,
      });
    }
    throw err;
  }
}

/**
 * @param {number} taskId
 * @param {number} attachmentId
 * @param {{ inline?: boolean }} [opts]
 */
export async function getAttachmentDownloadUrl(
  taskId,
  attachmentId,
  opts = {},
) {
  const row = await getAttachmentRow(taskId, attachmentId);
  if (!row) {
    throw Object.assign(new Error("Attachment not found"), { status: 404 });
  }
  const { downloadUrl, expiresIn } = await presignGet({
    storageKey: row.storage_key,
    fileName: row.file_name,
    disposition: opts.inline ? "inline" : "attachment",
    contentType: row.mime_type || null,
  });
  return {
    downloadUrl,
    expiresIn,
    attachment: mapAttachmentRow(row),
  };
}

/**
 * @param {number} taskId
 * @param {number} attachmentId
 */
/**
 * @param {number} taskId
 * @param {number} attachmentId
 * @param {unknown} body
 * @param {string} actorUserId
 */
export async function updateAttachmentType(
  taskId,
  attachmentId,
  body,
  actorUserId,
) {
  const row = await getAttachmentRow(taskId, attachmentId);
  if (!row) {
    throw Object.assign(new Error("Attachment not found"), { status: 404 });
  }

  if (!body || typeof body !== "object" || !("attachmentTypeId" in body)) {
    throw Object.assign(new Error("Missing attachmentTypeId"), { status: 400 });
  }
  const nextTypeId = parseOptionalAttachmentTypeId(body);
  const currentTypeId =
    row.attachment_type_id != null ? Number(row.attachment_type_id) : null;
  if (nextTypeId === currentTypeId) {
    return mapAttachmentRow(row);
  }

  const pool = getPool();
  const mimeType = String(row.mime_type);
  if (nextTypeId != null) {
    await assertAttachmentTypeAllowsMime(pool, nextTypeId, mimeType);
  }

  const [oldDef, newDef] = await Promise.all([
    currentTypeId != null
      ? loadActiveAttachmentTypeById(pool, currentTypeId)
      : null,
    nextTypeId != null ? loadActiveAttachmentTypeById(pool, nextTypeId) : null,
  ]);

  await pool.query(
    `UPDATE task_attachments
     SET attachment_type_id = $1
     WHERE id = $2 AND task_id = $3`,
    [nextTypeId, attachmentId, taskId],
  );

  const fileLabel =
    row.file_name && String(row.file_name).trim()
      ? String(row.file_name).trim()
      : String(row.kind);
  const oldLabel = oldDef?.label ?? "No type";
  const newLabel = newDef?.label ?? "No type";
  const summary = `${fileLabel}: ${oldLabel} → ${newLabel}`;

  await recordTaskHistoryEvent(pool, {
    taskId,
    eventType: "attachment_type_changed",
    actorUserId,
    summary,
  });

  const updated = await getAttachmentRow(taskId, attachmentId);
  if (!updated) {
    throw Object.assign(new Error("Attachment not found"), { status: 404 });
  }
  return mapAttachmentRow(updated);
}

export async function deleteAttachment(taskId, attachmentId) {
  const row = await getAttachmentRow(taskId, attachmentId);
  if (!row) {
    throw Object.assign(new Error("Attachment not found"), { status: 404 });
  }

  const pool = getPool();
  await pool.query(
    `DELETE FROM task_attachments WHERE id = $1 AND task_id = $2`,
    [attachmentId, taskId],
  );

  try {
    await deleteObject(row.storage_key);
  } catch (err) {
    console.error(
      `Failed to delete S3 object ${row.storage_key}:`,
      err instanceof Error ? err.message : err,
    );
  }
}
