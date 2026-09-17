import { mimeMatchesAttachmentCategories } from "../shared/attachmentMimeCategories.js";
import {
  mapAttachmentTypeDefRow,
  normalizeAttachmentTypeSlug,
  slugifyAttachmentTypeLabel,
} from "../shared/attachmentTypeDefs.js";
import { getPool } from "./db.mjs";

/**
 * @param {import('pg').Pool | import('pg').PoolClient} db
 */
export async function listActiveAttachmentTypeDefs(db) {
  const { rows } = await db.query(
    `SELECT id, slug, label, allowed_mime_categories, show_when, sort_order
     FROM org_attachment_type_defs
     WHERE retired_at IS NULL
     ORDER BY sort_order ASC, id ASC`,
  );
  return rows.map(mapAttachmentTypeDefRow);
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {number} id
 */
export async function loadActiveAttachmentTypeById(db, id) {
  const typeId = Number(id);
  if (!Number.isInteger(typeId) || typeId < 1) return null;
  const { rows } = await db.query(
    `SELECT id, slug, label, allowed_mime_categories, show_when, sort_order
     FROM org_attachment_type_defs
     WHERE id = $1 AND retired_at IS NULL`,
    [typeId],
  );
  return rows[0] ? mapAttachmentTypeDefRow(rows[0]) : null;
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {string} slug
 */
export async function loadActiveAttachmentTypeBySlug(db, slug) {
  const normalized = normalizeAttachmentTypeSlug(slug);
  if (!normalized) return null;
  const { rows } = await db.query(
    `SELECT id, slug, label, allowed_mime_categories, show_when, sort_order
     FROM org_attachment_type_defs
     WHERE lower(slug) = $1 AND retired_at IS NULL
     LIMIT 1`,
    [normalized],
  );
  return rows[0] ? mapAttachmentTypeDefRow(rows[0]) : null;
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {number | null | undefined} attachmentTypeId
 * @param {string} mimeType
 */
export async function assertAttachmentTypeAllowsMime(db, attachmentTypeId, mimeType) {
  if (attachmentTypeId == null || attachmentTypeId === "") return null;
  const typeId = Number(attachmentTypeId);
  if (!Number.isInteger(typeId) || typeId < 1) {
    throw Object.assign(new Error("Invalid attachmentTypeId"), { status: 400 });
  }
  const def = await loadActiveAttachmentTypeById(db, typeId);
  if (!def) {
    throw Object.assign(new Error("Attachment type not found"), { status: 400 });
  }
  if (!mimeMatchesAttachmentCategories(mimeType, def.allowedMimeCategories)) {
    throw Object.assign(
      new Error(`File type is not allowed for attachment type "${def.label}"`),
      { status: 400 },
    );
  }
  return def;
}

/**
 * @param {unknown} body
 */
export function parseOptionalAttachmentTypeId(body) {
  if (!body || typeof body !== "object") return null;
  const raw = /** @type {Record<string, unknown>} */ (body).attachmentTypeId;
  if (raw === null || raw === undefined || raw === "") return null;
  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1) {
    throw Object.assign(new Error("Invalid attachmentTypeId"), { status: 400 });
  }
  return id;
}

export { slugifyAttachmentTypeLabel, normalizeAttachmentTypeSlug };
