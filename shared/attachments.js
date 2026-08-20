/**
 * Attachment size limits and MIME-type validation — shared by the API
 * (server/attachments.mjs) and the web client (src/api/attachments.ts)
 * so the two sides cannot drift apart.
 */

export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
export const MAX_VIDEO_ATTACHMENT_BYTES = 150 * 1024 * 1024;

/** @type {ReadonlySet<string>} */
export const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/gif",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "text/plain",
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

/**
 * @param {string} mimeType
 */
export function normalizeMimeType(mimeType) {
  // Strip parameters (e.g. "video/mp4; codecs=avc1") and whitespace.
  return mimeType.toLowerCase().split(";")[0].trim();
}

/**
 * @param {string} mimeType
 */
export function isVideoMimeType(mimeType) {
  return normalizeMimeType(mimeType).startsWith("video/");
}

/**
 * @param {string} mimeType
 */
export function maxBytesForMimeType(mimeType) {
  return isVideoMimeType(mimeType)
    ? MAX_VIDEO_ATTACHMENT_BYTES
    : MAX_ATTACHMENT_BYTES;
}

/**
 * @param {string} mimeType
 * @param {number} maxBytes
 */
export function oversizeErrorMessage(mimeType, maxBytes) {
  if (isVideoMimeType(mimeType)) {
    return `Video exceeds ${Math.round(maxBytes / (1024 * 1024))} MB. Record at a lower resolution (try 1080p) if possible.`;
  }
  return `File exceeds ${Math.round(maxBytes / (1024 * 1024))} MB limit`;
}

/**
 * @param {string} mimeType
 */
export function kindFromMimeType(mimeType) {
  if (mimeType.startsWith("image/")) return "photo";
  if (isVideoMimeType(mimeType)) return "video";
  return "document";
}
