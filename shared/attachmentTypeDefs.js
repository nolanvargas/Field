/**
 * Task attachment type (TAT) slug + visibility helpers.
 */

import { isCustomFieldVisible } from "./customFieldShowWhen.js";
import { normalizeAttachmentMimeCategories } from "./attachmentMimeCategories.js";
import { normalizeShowWhen } from "./customFieldShowWhen.js";

/**
 * @param {unknown} slug
 * @returns {string}
 */
export function normalizeAttachmentTypeSlug(slug) {
  const s = String(slug ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 100);
  return s;
}

/**
 * @param {unknown} label
 * @returns {string}
 */
export function slugifyAttachmentTypeLabel(label) {
  const fromLabel = normalizeAttachmentTypeSlug(label);
  return fromLabel || "attachment_type";
}

/**
 * @param {{ showWhen?: unknown } | null | undefined} def
 * @param {unknown} taskTypeName
 */
export function isAttachmentTypeVisible(def, taskTypeName) {
  return isCustomFieldVisible(def, taskTypeName);
}

/**
 * @param {import('pg').QueryResultRow} row
 */
export function mapAttachmentTypeDefRow(row) {
  return {
    id: Number(row.id),
    slug: String(row.slug),
    label: String(row.label ?? ""),
    allowedMimeCategories: normalizeAttachmentMimeCategories(
      row.allowed_mime_categories,
    ),
    showWhen: normalizeShowWhen(row.show_when),
    sortOrder: Number(row.sort_order ?? 0),
  };
}
