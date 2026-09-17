/**
 * MIME category buckets for task attachment types — shared by API and client.
 */

import { ALLOWED_MIME_TYPES, normalizeMimeType } from "./attachments.js";

/** @typedef {'image' | 'video' | 'pdf' | 'other'} AttachmentMimeCategory */

/** @type {readonly AttachmentMimeCategory[]} */
export const ATTACHMENT_MIME_CATEGORIES = Object.freeze([
  "image",
  "video",
  "pdf",
  "other",
]);

/** @type {ReadonlySet<AttachmentMimeCategory>} */
export const ATTACHMENT_MIME_CATEGORY_SET = new Set(ATTACHMENT_MIME_CATEGORIES);

/** @type {readonly AttachmentMimeCategory[]} */
export const DEFAULT_ATTACHMENT_MIME_CATEGORIES = Object.freeze([
  "image",
  "video",
  "pdf",
  "other",
]);

/**
 * @param {string} mimeType
 * @returns {AttachmentMimeCategory}
 */
export function mimeToAttachmentCategory(mimeType) {
  const mime = normalizeMimeType(mimeType);
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime === "application/pdf") return "pdf";
  return "other";
}

/**
 * @param {unknown} raw
 * @returns {AttachmentMimeCategory[]}
 */
export function normalizeAttachmentMimeCategories(raw) {
  if (raw == null) return [...DEFAULT_ATTACHMENT_MIME_CATEGORIES];
  if (!Array.isArray(raw)) return [...DEFAULT_ATTACHMENT_MIME_CATEGORIES];
  /** @type {AttachmentMimeCategory[]} */
  const out = [];
  const seen = new Set();
  for (const item of raw) {
    const cat = String(item ?? "").trim();
    if (!ATTACHMENT_MIME_CATEGORY_SET.has(/** @type {AttachmentMimeCategory} */ (cat))) {
      continue;
    }
    if (seen.has(cat)) continue;
    seen.add(cat);
    out.push(/** @type {AttachmentMimeCategory} */ (cat));
  }
  return out.length > 0 ? out : [...DEFAULT_ATTACHMENT_MIME_CATEGORIES];
}

/**
 * @param {string} mimeType
 * @param {AttachmentMimeCategory[]} categories
 */
export function mimeMatchesAttachmentCategories(mimeType, categories) {
  const cats = normalizeAttachmentMimeCategories(categories);
  const bucket = mimeToAttachmentCategory(mimeType);
  if (!cats.includes(bucket)) return false;
  const mime = normalizeMimeType(mimeType);
  if (!ALLOWED_MIME_TYPES.has(mime)) return false;
  return true;
}

/**
 * @param {AttachmentMimeCategory[]} categories
 * @returns {ReadonlySet<string>}
 */
export function allowedMimeTypesForCategories(categories) {
  const cats = normalizeAttachmentMimeCategories(categories);
  /** @type {Set<string>} */
  const out = new Set();
  for (const mime of ALLOWED_MIME_TYPES) {
    if (cats.includes(mimeToAttachmentCategory(mime))) {
      out.add(mime);
    }
  }
  return out;
}
