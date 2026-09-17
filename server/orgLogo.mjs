import Busboy from "busboy";
import { getPool } from "./db.mjs";
import {
  deleteObject,
  getObjectBuffer,
  putObject,
  readLocalObjectResponse,
} from "./storage.mjs";
import { invalidateOrgSettingsCache } from "./orgSettings.mjs";
import {
  ORG_LOGO_ALLOWED_MIME_TYPES,
  ORG_LOGO_MAX_BYTES,
  ORG_LOGO_STORAGE_KEY,
  normalizeOrgLogoMimeType,
  orgLogoPublicPath,
} from "../shared/orgLogo.js";

/**
 * @typedef {{ storageKey: string, mimeType: string, updatedAt: string }} OrgLogoMeta
 */

/**
 * @param {import('pg').QueryResultRow | null | undefined} row
 * @returns {OrgLogoMeta | null}
 */
export function orgLogoMetaFromRow(row) {
  const storageKey = row?.logo_storage_key != null
    ? String(row.logo_storage_key).trim()
    : "";
  const mimeType = normalizeOrgLogoMimeType(row?.logo_mime_type);
  const updatedAt = row?.logo_updated_at
    ? new Date(row.logo_updated_at).toISOString()
    : null;
  if (!storageKey || !mimeType || !updatedAt) return null;
  return { storageKey, mimeType, updatedAt };
}

/**
 * @returns {Promise<OrgLogoMeta | null>}
 */
export async function getOrgLogoMeta() {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT logo_storage_key, logo_mime_type, logo_updated_at
     FROM org_settings
     WHERE id = 1`,
  );
  return orgLogoMetaFromRow(rows[0]);
}

/**
 * @param {OrgLogoMeta | null | undefined} meta
 * @returns {string | null}
 */
export function orgLogoUrl(meta) {
  return meta ? orgLogoPublicPath(meta.updatedAt) : null;
}

/**
 * @param {Buffer} buffer
 * @param {string} mimeType
 * @returns {Promise<OrgLogoMeta>}
 */
export async function uploadOrgLogo(buffer, mimeType) {
  const normalizedMime = normalizeOrgLogoMimeType(mimeType);
  if (!normalizedMime) {
    throw Object.assign(
      new Error(
        `Logo must be ${ORG_LOGO_ALLOWED_MIME_TYPES.map((m) => m.replace("image/", "")).join(", ")}`,
      ),
      { status: 400 },
    );
  }
  if (!buffer?.length) {
    throw Object.assign(new Error("Logo file is empty"), { status: 400 });
  }
  if (buffer.length > ORG_LOGO_MAX_BYTES) {
    throw Object.assign(new Error("Logo exceeds 1 MB limit"), { status: 400 });
  }

  const prior = await getOrgLogoMeta();
  if (prior?.storageKey && prior.storageKey !== ORG_LOGO_STORAGE_KEY) {
    await deleteObject(prior.storageKey).catch(() => {});
  }

  await putObject(ORG_LOGO_STORAGE_KEY, buffer, normalizedMime);

  const pool = getPool();
  const { rows } = await pool.query(
    `UPDATE org_settings
     SET logo_storage_key = $1,
         logo_mime_type = $2,
         logo_updated_at = now(),
         updated_at = now()
     WHERE id = 1
     RETURNING logo_storage_key, logo_mime_type, logo_updated_at`,
    [ORG_LOGO_STORAGE_KEY, normalizedMime],
  );
  invalidateOrgSettingsCache();
  const meta = orgLogoMetaFromRow(rows[0]);
  if (!meta) {
    throw new Error("Failed to save org logo");
  }
  return meta;
}

/**
 * @returns {Promise<void>}
 */
export async function deleteOrgLogo() {
  const prior = await getOrgLogoMeta();
  if (prior?.storageKey) {
    await deleteObject(prior.storageKey).catch(() => {});
  }

  const pool = getPool();
  await pool.query(
    `UPDATE org_settings
     SET logo_storage_key = NULL,
         logo_mime_type = NULL,
         logo_updated_at = NULL,
         updated_at = now()
     WHERE id = 1`,
  );
  invalidateOrgSettingsCache();
}

/**
 * @returns {Promise<Buffer | null>}
 */
export async function readOrgLogoBuffer() {
  const meta = await getOrgLogoMeta();
  if (!meta) return null;
  return getObjectBuffer(meta.storageKey);
}

/**
 * @returns {Promise<{ buf: Buffer, headers: Record<string, string | number>, meta: OrgLogoMeta } | null>}
 */
export async function readOrgLogoHttpResponse() {
  const meta = await getOrgLogoMeta();
  if (!meta) return null;
  const { buf, headers } = await readLocalObjectResponse(meta.storageKey, {
    inline: true,
    contentType: meta.mimeType,
  });
  const updatedMs = new Date(meta.updatedAt).getTime();
  return {
    buf,
    headers: {
      ...headers,
      "Cache-Control": "public, max-age=3600",
      ETag: `"org-logo-${updatedMs}"`,
    },
    meta,
  };
}

/**
 * @param {import('node:http').IncomingMessage} req
 * @returns {Promise<{ buffer: Buffer, mimeType: string }>}
 */
export function readMultipartOrgLogo(req) {
  return new Promise((resolve, reject) => {
    const contentType = req.headers["content-type"] ?? "";
    if (!contentType.includes("multipart/form-data")) {
      reject(
        Object.assign(new Error("Content-Type must be multipart/form-data"), {
          status: 400,
        }),
      );
      return;
    }

    /** @type {Buffer[]} */
    const chunks = [];
    let found = false;
    let mimeType = "";

    const busboy = Busboy({
      headers: /** @type {Record<string, string>} */ (req.headers),
      limits: { fileSize: ORG_LOGO_MAX_BYTES, files: 1 },
    });

    busboy.on("file", (field, stream, info) => {
      if (field !== "file") {
        stream.resume();
        return;
      }
      found = true;
      mimeType = info.mimeType ?? "";
      stream.on("data", (chunk) => chunks.push(chunk));
      stream.on("limit", () => {
        reject(
          Object.assign(new Error("Logo exceeds 1 MB limit"), { status: 400 }),
        );
      });
    });

    busboy.on("error", (err) => reject(err));
    busboy.on("finish", () => {
      if (!found) {
        reject(Object.assign(new Error("file field is required"), { status: 400 }));
        return;
      }
      resolve({ buffer: Buffer.concat(chunks), mimeType });
    });

    req.pipe(busboy);
  });
}
