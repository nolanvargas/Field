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
import { trackingPageTemplateFromDb } from "../shared/trackingPageTemplate.js";
import { getTrackingPageHistory } from "./taskHistory.mjs";
import { trackingPath, trackingUrl } from "./trackingToken.mjs";

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
 * Customer-facing noun per task type. Delivery keeps "order" so existing
 * delivery wording is unchanged; see emails/task-completed.html for parity.
 * @type {Record<string, string>}
 */
const TYPE_NOUNS = {
  Delivery: "order",
  Install: "install",
  Removal: "removal",
  "Site Survey": "site survey",
  Pickup: "pickup",
  Other: "order",
};

/**
 * @param {string} taskType
 */
function nounForType(taskType) {
  return TYPE_NOUNS[taskType] ?? "order";
}

/**
 * @param {string} taskType
 * @param {string} status
 */
function headlineFor(taskType, status) {
  const noun = nounForType(taskType);
  switch (status) {
    case "Completed":
      return taskType === "Delivery"
        ? "Your order has been delivered!"
        : `Your ${noun} is complete!`;
    case "Failed":
      return `Your ${noun} could not be completed`;
    case "Cancelled":
      return `Your ${noun} was cancelled`;
    case "In Progress":
      return taskType === "Delivery"
        ? `Your ${noun} is on the way`
        : `Your ${noun} is in progress`;
    case "Assigned":
      return `Your ${noun} has been assigned`;
    default:
      return `Track your ${noun}`;
  }
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
  const headline = headlineFor(taskType, status);
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
    "task.headline": headline,
    "task.job_title": row.job_title ?? "",
    "task.status": status,
    "task.task_type": taskType,
    "task.destination_name": row.destination_name ?? "",
    "task.completed_at": completedAtDisplay,
    "task.external_key": row.external_key ?? "",
    "task.contact_name": row.contact_name ?? "",
    "company.name": companyName(),
  };

  return {
    jobTitle: row.job_title ?? "",
    status,
    taskType,
    headline,
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
