/**
 * Unauthenticated customer tracking: task summary, safe history, PDF download.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getPool } from "./db.mjs";
import {
  CURRENT_PRINT_STORAGE_PREFIX,
  printFileName,
  printStorageKind,
  renderPrint,
} from "./print.mjs";
import { companyName } from "./branding.mjs";
import { getOrgSettings } from "./orgSettings.mjs";
import {
  defaultTrackingDocumentKinds,
  defaultTrackingPageDocumentKinds,
  getDocumentType,
} from "../shared/documentTypes.js";
import {
  trackingImageAttachmentTatKeys,
  trackingPageTemplateFromDb,
} from "../shared/trackingPageTemplate.js";
import { getTrackingPageHistory } from "./taskHistory.mjs";
import { trackingPath, trackingUrl } from "./trackingToken.mjs";
import { getObjectBuffer } from "./storage.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const STORAGE_ROOT = path.join(ROOT, "storage");

const TRACKING_DOC_KINDS = new Set(defaultTrackingDocumentKinds());

/**
 * @param {unknown} token
 * @returns {string}
 */
function normalizeToken(token) {
  if (typeof token !== "string") return "";
  return token.trim();
}

/**
 * @param {string} storageKey
 */
async function readLocalDocument(storageKey) {
  const key = String(storageKey || "").replace(/^[/\\]+/, "");
  if (!key || key.includes("..")) {
    throw Object.assign(new Error("Invalid document path"), { status: 400 });
  }
  const fullPath = path.join(STORAGE_ROOT, key);
  if (!fullPath.startsWith(STORAGE_ROOT)) {
    throw Object.assign(new Error("Invalid document path"), { status: 400 });
  }
  try {
    return await readFile(fullPath);
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "ENOENT") {
      return null;
    }
    throw err;
  }
}

/**
 * @param {string} token
 */
export async function getTrackingPageByToken(token) {
  const trackingToken = normalizeToken(token);
  if (!trackingToken || trackingToken.length > 64) {
    throw Object.assign(new Error("Not found"), { status: 404 });
  }

  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT
       t.id,
       t.status,
       t.task_type,
       t.job_title,
       t.external_key,
       t.completed_at,
       t.tracking_token,
       COALESCE(t.destination_address_name, t.destination_address, '') AS destination_name,
       (
         SELECT c.name
         FROM task_contacts tc
         JOIN contacts c ON c.id = tc.contact_id
         WHERE tc.task_id = t.id
         ORDER BY tc.is_poc DESC, c.name
         LIMIT 1
       ) AS contact_name,
       ott.tracking_page_template
     FROM tasks t
     LEFT JOIN org_task_types ott
       ON ott.name = t.task_type
      AND ott.retired_at IS NULL
     WHERE t.tracking_token = $1
       AND t.deleted_at IS NULL`,
    [trackingToken],
  );

  if (rows.length === 0) {
    throw Object.assign(new Error("Not found"), { status: 404 });
  }

  const row = rows[0];
  const taskId = Number(row.id);

  const publicKinds = defaultTrackingDocumentKinds();
  const { rows: docRows } = await pool.query(
    `SELECT kind, file_name
     FROM task_documents
     WHERE task_id = $1
       AND kind = ANY($2::text[])`,
    [taskId, publicKinds],
  );

  /** @type {Map<string, string>} */
  const byKind = new Map();
  for (const d of docRows) {
    byKind.set(String(d.kind), String(d.file_name ?? d.kind));
  }

  const taskType = String(row.task_type ?? "");
  const status = String(row.status);
  const documents = defaultTrackingPageDocumentKinds(taskType).map((kind) => {
    if (kind === "delivery_docket") {
      return {
        kind,
        fileName:
          byKind.get(printStorageKind(kind)) ??
          byKind.get(kind) ??
          printFileName(kind, taskId),
        available: true,
      };
    }
    if (kind === "proof_of_completion") {
      return {
        kind,
        fileName:
          byKind.get(kind) ??
          printFileName(kind, taskId),
        available: status === "Completed" || byKind.has(kind),
      };
    }
    return {
      kind,
      fileName: byKind.get(kind) ?? printFileName(kind, taskId),
      available: byKind.has(kind),
    };
  });

  const history = await getTrackingPageHistory(taskId);
  const completedAtIso = row.completed_at
    ? new Date(row.completed_at).toISOString()
    : null;
  const completedAtDisplay = completedAtIso
    ? new Date(completedAtIso).toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "";

  const trackingPageTemplate = trackingPageTemplateFromDb(
    row.tracking_page_template,
    taskType,
  );
  const org = await getOrgSettings();

  const mergeTags = {
    "task.job_title": row.job_title ?? "",
    "task.status": status,
    "task.task_type": taskType,
    "task.destination_name": row.destination_name ?? "",
    "task.completed_at": completedAtDisplay,
    "task.external_key": row.external_key ?? "",
    "task.contact_name": row.contact_name ?? "",
    "company.name": companyName(),
  };

  const trackingTatKeys = trackingImageAttachmentTatKeys(
    trackingPageTemplate.blocks,
  );
  /** @type {Array<{ url: string, alt: string, fileName: string, mimeType: string, id: number }>} */
  let imageAttachments = [];
  if (trackingTatKeys.length > 0) {
    const { rows: imageRows } = await pool.query(
      `SELECT a.id, a.file_name, a.caption, a.mime_type
       FROM task_attachments a
       INNER JOIN org_attachment_type_defs tat ON tat.id = a.attachment_type_id
       WHERE a.task_id = $1
         AND lower(a.mime_type) LIKE 'image/%'
         AND lower(tat.slug) = ANY($2::text[])
         AND tat.retired_at IS NULL
       ORDER BY a.created_at ASC, a.id ASC`,
      [taskId, trackingTatKeys],
    );
    imageAttachments = imageRows.map((imageRow) => {
      const fileName = String(imageRow.file_name || "Completion image");
      const alt = imageRow.caption ? String(imageRow.caption) : fileName;
      return {
        id: Number(imageRow.id),
        url: `/api/tracking/tasks/${encodeURIComponent(trackingToken)}/attachments/${Number(imageRow.id)}`,
        alt,
        fileName,
        mimeType: String(imageRow.mime_type || "image/jpeg"),
      };
    });
  }

  return {
    jobTitle: row.job_title ?? "",
    status,
    taskType,
    destinationName: row.destination_name ?? "",
    destinationLabel: taskType === "Delivery" ? "Delivered to" : "Location",
    completedAt: completedAtIso,
    documents,
    history,
    trackingPath: trackingPath(String(row.tracking_token)),
    trackingUrl: trackingUrl(String(row.tracking_token)),
    trackingPageTemplate,
    mergeTags,
    accentColor: org.accentColor,
    logoUrl: org.logoUrl,
    imageAttachments: imageAttachments.map(({ id: _id, ...rest }) => rest),
  };
}

/**
 * Resolve public document access context.
 * @param {string} token
 */
async function resolveTaskByToken(token) {
  const trackingToken = normalizeToken(token);
  if (!trackingToken || trackingToken.length > 64) {
    throw Object.assign(new Error("Not found"), { status: 404 });
  }

  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT id, task_type, status
     FROM tasks
     WHERE tracking_token = $1 AND deleted_at IS NULL`,
    [trackingToken],
  );
  if (rows.length === 0) {
    throw Object.assign(new Error("Not found"), { status: 404 });
  }
  return {
    id: Number(rows[0].id),
    taskType: String(rows[0].task_type),
    status: String(rows[0].status),
  };
}

/**
 * @param {string} token
 * @param {string} kind
 * @param {(id: number) => Promise<Record<string, unknown> | null>} getTask
 * @returns {Promise<{ buffer: Buffer, fileName: string }>}
 */
export async function getTrackingDocument(token, kind, getTask) {
  const docKind = typeof kind === "string" ? kind.trim() : "";
  const docType = getDocumentType(docKind);
  if (!docType?.onTrackingPage || !TRACKING_DOC_KINDS.has(docKind)) {
    throw Object.assign(new Error("Not found"), { status: 404 });
  }

  const resolvedTask = await resolveTaskByToken(token);
  const taskId = resolvedTask.id;
  const pool = getPool();

  if (docKind === "delivery_docket") {
    if (resolvedTask.taskType !== "Delivery") {
      throw Object.assign(new Error("Not found"), { status: 404 });
    }
    const storageKind = printStorageKind("delivery_docket");
    const { rows } = await pool.query(
      `SELECT d.storage_key,
              d.file_name,
              NOT EXISTS (
                SELECT 1
                FROM task_attachments a
                WHERE a.task_id = d.task_id
                  AND lower(a.mime_type) LIKE 'image/%'
                  AND a.created_at > d.generated_at
              ) AS is_current
       FROM task_documents d
       WHERE d.task_id = $1
         AND d.kind = $2
         AND d.storage_key LIKE $3 || '%'`,
      [taskId, storageKind, CURRENT_PRINT_STORAGE_PREFIX],
    );
    if (rows[0]?.is_current) {
      const buf = await readLocalDocument(String(rows[0].storage_key));
      if (buf) {
        return {
          buffer: buf,
          fileName: String(
            rows[0].file_name || printFileName("delivery_docket", taskId),
          ),
        };
      }
    }

    const task = await getTask(taskId);
    if (!task) {
      throw Object.assign(new Error("Not found"), { status: 404 });
    }
    const { buffer, fileName } = await renderPrint(
      "delivery_docket",
      { context: "task", taskId },
      { getTask, generatedByUserId: null, task },
    );
    return { buffer, fileName };
  }

  // proof_of_completion — serve stored documents only (no template in v1).
  const storageKind = printStorageKind(docKind);
  const { rows } = await pool.query(
    `SELECT storage_key, file_name
     FROM task_documents
     WHERE task_id = $1
       AND kind = $2
     LIMIT 1`,
    [taskId, storageKind],
  );
  if (!rows[0]) {
    throw Object.assign(
      new Error(`${docType.label} is not available yet`),
      { status: 404 },
    );
  }
  const buf = await readLocalDocument(String(rows[0].storage_key));
  if (!buf) {
    throw Object.assign(
      new Error(`${docType.label} is not available yet`),
      { status: 404 },
    );
  }
  return {
    buffer: buf,
    fileName: String(rows[0].file_name || printFileName(docKind, taskId)),
  };
}

/**
 * Public completion image for a tracking page.
 * @param {string} token
 * @param {number} attachmentId
 * @returns {Promise<{ buffer: Buffer, fileName: string, mimeType: string }>}
 */
/**
 * @param {import('pg').Pool} pool
 * @param {number} taskId
 */
async function trackingTatKeysForTask(pool, taskId) {
  const { rows } = await pool.query(
    `SELECT t.task_type, ott.tracking_page_template
     FROM tasks t
     LEFT JOIN org_task_types ott
       ON ott.name = t.task_type AND ott.retired_at IS NULL
     WHERE t.id = $1 AND t.deleted_at IS NULL`,
    [taskId],
  );
  if (!rows[0]) return [];
  const template = trackingPageTemplateFromDb(
    rows[0].tracking_page_template,
    String(rows[0].task_type ?? ""),
  );
  return trackingImageAttachmentTatKeys(template.blocks);
}

export async function getTrackingImageAttachment(token, attachmentId) {
  const id = Number(attachmentId);
  if (!Number.isInteger(id) || id <= 0) {
    throw Object.assign(new Error("Not found"), { status: 404 });
  }

  const resolvedTask = await resolveTaskByToken(token);
  const pool = getPool();
  const tatKeys = await trackingTatKeysForTask(pool, resolvedTask.id);
  if (tatKeys.length === 0) {
    throw Object.assign(new Error("Not found"), { status: 404 });
  }

  const { rows } = await pool.query(
    `SELECT a.storage_key, a.mime_type, a.file_name
     FROM task_attachments a
     INNER JOIN org_attachment_type_defs tat ON tat.id = a.attachment_type_id
     WHERE a.id = $1
       AND a.task_id = $2
       AND lower(a.mime_type) LIKE 'image/%'
       AND lower(tat.slug) = ANY($3::text[])
       AND tat.retired_at IS NULL`,
    [id, resolvedTask.id, tatKeys],
  );
  if (!rows[0]) {
    throw Object.assign(new Error("Not found"), { status: 404 });
  }

  const mimeType = String(rows[0].mime_type || "image/jpeg");
  const fileName = String(rows[0].file_name || "Completion image");
  try {
    const buffer = await getObjectBuffer(String(rows[0].storage_key));
    return { buffer, fileName, mimeType };
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "ENOENT") {
      throw Object.assign(new Error("Not found"), { status: 404 });
    }
    throw err;
  }
}
