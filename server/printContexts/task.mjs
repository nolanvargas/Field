/**
 * Task print context — fetch task data, build tags, load image attachments.
 */

import sharp from "sharp";
import { companyName } from "../branding.mjs";
import { getPool } from "../db.mjs";
import {
  formatBodyDate,
  htmlToPlainText,
} from "../pdfLayout.mjs";
import { renderDocumentTemplate } from "../renderDocumentTemplate.mjs";
import { getObjectBuffer } from "../storage.mjs";
import { storeTaskDocumentPdf } from "../taskDocuments.mjs";
import {
  printFileName,
  printStorageKey,
  printStorageKind,
} from "../printStorage.mjs";

/**
 * @param {unknown} value
 */
function display(value) {
  if (value == null || String(value).trim() === "") return "n/a";
  return String(value).trim();
}

/** @param {string} label */
function slugifyLabel(label) {
  return String(label)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

/**
 * @returns {string[]}
 */
export function listTaskPrintTagNames() {
  return [
    "task.id",
    "task.external_key",
    "task.status",
    "task.task_type",
    "task.description",
    "task.job_title",
    "task.destination_name",
    "task.destination_address",
    "task.destination_building",
    "task.destination_notes",
    "task.contact_name",
    "task.contact_email",
    "task.contact_phone",
    "task.crew_names",
    "task.completed_notes",
    "task.completed_at",
    "task.created_at",
    "task.created_by_name",
    "task.completion_notes_by_name",
    "task.received_by_line",
    "company.name",
    "task.custom_fields.{slot}",
    "task.custom_field.{label_slug}",
  ];
}

/**
 * @param {Record<string, unknown>} task
 * @returns {Record<string, string>}
 */
export function buildTaskTagMap(task) {
  /** @type {Record<string, string>} */
  const tags = {};

  const set = (name, value) => {
    tags[name] = display(value);
  };

  set("task.id", task.id);
  set("task.external_key", task.externalKey);
  set("task.status", task.status);
  set("task.task_type", task.taskType);
  set("task.description", htmlToPlainText(task.description));
  set("task.job_title", task.jobTitle);
  set("task.destination_name", task.destinationAddressName);
  set("task.destination_address", task.destinationAddress);
  set("task.destination_building", task.destinationBuilding);
  set("task.destination_notes", task.destinationNotes);
  set("task.completed_notes", task.completedNotes);
  set("task.completed_at", formatBodyDate(task.completedAt));
  set("task.created_at", formatBodyDate(task.createdAt));
  set("task.created_by_name", task.createdByName);
  set("task.completion_notes_by_name", task.completionNotesByName);
  set("company.name", companyName());

  const receivedParts = [];
  if (
    typeof task.completionNotesByName === "string" &&
    task.completionNotesByName.trim()
  ) {
    receivedParts.push(task.completionNotesByName.trim());
  }
  if (task.completedAt) {
    receivedParts.push(formatBodyDate(task.completedAt));
  }
  set(
    "task.received_by_line",
    receivedParts.length > 0 ? receivedParts.join(" , ") : null,
  );

  const contacts = Array.isArray(task.contacts) ? task.contacts : [];
  const poc =
    contacts.find((c) => c && typeof c === "object" && c.isPoc) ?? contacts[0];
  if (poc && typeof poc === "object") {
    set("task.contact_name", poc.name);
    set("task.contact_email", poc.email);
    set("task.contact_phone", poc.phone);
  } else {
    set("task.contact_name", null);
    set("task.contact_email", null);
    set("task.contact_phone", null);
  }

  const crewMembers = Array.isArray(task.crewMembers) ? task.crewMembers : [];
  set(
    "task.crew_names",
    crewMembers
      .map((m) =>
        m && typeof m === "object" ? String(m.displayName ?? "").trim() : "",
      )
      .filter(Boolean)
      .join(", ") || null,
  );

  const customFieldDisplays =
    task.customFieldDisplays &&
    typeof task.customFieldDisplays === "object" &&
    !Array.isArray(task.customFieldDisplays)
      ? task.customFieldDisplays
      : {};
  const customFieldDefs = Array.isArray(task.customFieldDefs)
    ? task.customFieldDefs
    : [];

  for (const def of customFieldDefs) {
    if (!def || typeof def !== "object") continue;
    const slot = String(def.slot);
    const label = String(def.label ?? "");
    const value = customFieldDisplays[slot] ?? null;
    set(`task.custom_fields.${slot}`, value);
    const slug = slugifyLabel(label);
    if (slug) {
      set(`task.custom_field.${slug}`, value);
    }
  }

  return tags;
}

/**
 * @param {number} taskId
 */
export async function loadTaskImageAttachments(taskId) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT storage_key, file_name, caption
     FROM task_attachments
     WHERE task_id = $1
       AND lower(mime_type) LIKE 'image/%'
     ORDER BY created_at ASC, id ASC`,
    [taskId],
  );

  return Promise.all(
    rows.map(async (row) => {
      const source = await getObjectBuffer(String(row.storage_key));
      const buffer = await sharp(source)
        .autoOrient()
        .resize({ width: 900, height: 900, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 82, mozjpeg: true })
        .toBuffer();
      return {
        buffer,
        fileName: row.file_name ? String(row.file_name) : "Image attachment",
        caption: row.caption ? String(row.caption) : null,
      };
    }),
  );
}

/**
 * @param {import('../renderDocumentTemplate.mjs').PrintTemplateDefinition} template
 * @param {Record<string, unknown>} task
 */
export async function renderTaskPrintTemplate(template, task) {
  const taskId = Number(task.id);
  const tagMap = buildTaskTagMap(task);
  const imageAttachments = Number.isFinite(taskId)
    ? await loadTaskImageAttachments(taskId)
    : [];
  return renderDocumentTemplate(template, {
    tagMap,
    companyName: companyName(),
    imageAttachments,
  });
}

/**
 * @param {string} templateKey
 * @param {import('../renderDocumentTemplate.mjs').PrintTemplateDefinition} template
 * @param {Record<string, unknown>} task
 */
function assertTaskStatusGuard(template, task) {
  const required = template.requiresStatus;
  if (!required) return;
  if (String(task.status) !== required) {
    throw Object.assign(
      new Error(`${template.label} is only available for ${required} tasks`),
      { status: 409 },
    );
  }
}

/**
 * @param {string} templateKey
 * @param {import('../renderDocumentTemplate.mjs').PrintTemplateDefinition} template
 * @param {Record<string, unknown>} task
 * @param {{ generatedByUserId?: string | null }} [opts]
 */
export async function renderAndStoreTaskPrint(
  templateKey,
  template,
  task,
  opts = {},
) {
  const taskId = Number(task.id);
  if (!Number.isFinite(taskId)) {
    throw Object.assign(new Error("Invalid task id"), { status: 400 });
  }

  assertTaskStatusGuard(template, task);

  const buffer = await renderTaskPrintTemplate(template, task);
  const kind = printStorageKind(templateKey);
  const storageKey = printStorageKey(templateKey, taskId);
  const fileName = printFileName(templateKey, taskId);

  return storeTaskDocumentPdf({
    taskId,
    kind,
    storageKey,
    fileName,
    buffer,
    generatedByUserId: opts.generatedByUserId,
  });
}

/**
 * @param {string} templateKey
 * @param {import('../renderDocumentTemplate.mjs').PrintTemplateDefinition} template
 * @param {Record<string, unknown>} task
 * @param {{ persist?: boolean, generatedByUserId?: string | null }} opts
 */
export async function resolveTaskPrint(templateKey, template, task, opts = {}) {
  assertTaskStatusGuard(template, task);

  const shouldPersist = opts.persist ?? template.persist === true;
  if (shouldPersist) {
    return renderAndStoreTaskPrint(templateKey, template, task, opts);
  }

  const buffer = await renderTaskPrintTemplate(template, task);
  const taskId = Number(task.id) || 0;
  return {
    buffer,
    fileName: printFileName(templateKey, taskId),
  };
}
