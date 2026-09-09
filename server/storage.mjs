import { randomUUID } from "node:crypto";
import { copyFile, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  PutObjectCommand,
  GetObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORAGE_ROOT = path.resolve(__dirname, "..", "storage");

const REGION = process.env.AWS_REGION || "us-west-1";
const BUCKET = process.env.S3_BUCKET?.trim() || "";

/** @type {S3Client | null} */
let client = null;

export function isS3Enabled() {
  return Boolean(BUCKET);
}

function getClient() {
  if (!client) {
    client = new S3Client({ region: REGION });
  }
  return client;
}

/**
 * @param {string} storageKey
 */
function resolveLocalPath(storageKey) {
  const key = String(storageKey || "").replace(/^[/\\]+/, "");
  if (!key || key.includes("..")) {
    throw Object.assign(new Error("Invalid storage key"), { status: 400 });
  }
  const fullPath = path.join(STORAGE_ROOT, key);
  if (!fullPath.startsWith(STORAGE_ROOT)) {
    throw Object.assign(new Error("Invalid storage key"), { status: 400 });
  }
  return fullPath;
}

/**
 * @param {string} storageKey
 */
export function localStorageUrl(storageKey) {
  const segments = String(storageKey)
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment));
  return `/api/local-storage/${segments.join("/")}`;
}

/**
 * @param {string} fileName
 */
export function sanitizeFileName(fileName) {
  const base = String(fileName || "file")
    .replace(/[/\\]/g, "_")
    .replace(/[^\w.\- ()+]/g, "_")
    .trim();
  const cleaned = base.replace(/^\.+/, "") || "file";
  return cleaned.slice(0, 180);
}

/**
 * @param {number} taskId
 * @param {string} fileName
 */
export function buildAttachmentStorageKey(taskId, fileName) {
  const safe = sanitizeFileName(fileName);
  return `attachments/${taskId}/${randomUUID()}-${safe}`;
}

/**
 * @param {number} taskId
 * @param {string} storageKey
 */
export function isValidAttachmentKeyForTask(taskId, storageKey) {
  const prefix = `attachments/${taskId}/`;
  return (
    typeof storageKey === "string" &&
    storageKey.startsWith(prefix) &&
    !storageKey.includes("..") &&
    storageKey.length <= 500
  );
}

/**
 * @param {{ storageKey: string, mimeType: string, expiresIn?: number }} opts
 */
export async function presignPut({ storageKey, mimeType, expiresIn = 900 }) {
  if (!isS3Enabled()) {
    return {
      uploadUrl: localStorageUrl(storageKey),
      storageKey,
      bucket: "local",
      mimeType,
      expiresIn,
    };
  }

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: storageKey,
    ContentType: mimeType,
  });
  const uploadUrl = await getSignedUrl(getClient(), command, { expiresIn });
  return { uploadUrl, storageKey, bucket: BUCKET };
}

/**
 * @param {{ storageKey: string, fileName?: string | null, disposition?: 'inline' | 'attachment', contentType?: string | null, expiresIn?: number }} opts
 */
export async function presignGet({
  storageKey,
  fileName = null,
  disposition = "attachment",
  contentType = null,
  expiresIn = 300,
}) {
  if (!isS3Enabled()) {
    const params = new URLSearchParams();
    if (fileName) params.set("fileName", sanitizeFileName(fileName));
    if (disposition === "inline") params.set("inline", "1");
    if (contentType) params.set("contentType", contentType);
    const qs = params.toString();
    const downloadUrl = qs
      ? `${localStorageUrl(storageKey)}?${qs}`
      : localStorageUrl(storageKey);
    return { downloadUrl, expiresIn };
  }

  /** @type {import('@aws-sdk/client-s3').GetObjectCommandInput} */
  const input = {
    Bucket: BUCKET,
    Key: storageKey,
  };
  if (fileName) {
    const safe = sanitizeFileName(fileName);
    const mode = disposition === "inline" ? "inline" : "attachment";
    input.ResponseContentDisposition = `${mode}; filename="${safe}"`;
  }
  if (contentType) {
    input.ResponseContentType = contentType;
  }
  const command = new GetObjectCommand(input);
  const downloadUrl = await getSignedUrl(getClient(), command, { expiresIn });
  return { downloadUrl, expiresIn };
}

/**
 * @param {string} storageKey
 * @param {Buffer} body
 * @param {string} [mimeType]
 */
export async function putLocalObject(storageKey, body, mimeType) {
  const fullPath = resolveLocalPath(storageKey);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, body);
  return { storageKey, mimeType: mimeType ?? null };
}

/**
 * @param {string} storageKey
 */
export async function localObjectExists(storageKey) {
  try {
    await readFile(resolveLocalPath(storageKey));
    return true;
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "ENOENT") {
      return false;
    }
    throw err;
  }
}

/**
 * Download an object for server-side processing.
 * @param {string} storageKey
 */
export async function getObjectBuffer(storageKey) {
  if (isS3Enabled()) {
    const result = await getClient().send(
      new GetObjectCommand({
        Bucket: BUCKET,
        Key: storageKey,
      }),
    );
    if (!result.Body) {
      throw new Error(`S3 object has no body: ${storageKey}`);
    }
    return Buffer.from(await result.Body.transformToByteArray());
  }

  return readFile(resolveLocalPath(storageKey));
}

/**
 * @param {string} storageKey
 */
export async function deleteObject(storageKey) {
  if (isS3Enabled()) {
    await getClient().send(
      new DeleteObjectCommand({
        Bucket: BUCKET,
        Key: storageKey,
      }),
    );
    return;
  }

  try {
    await unlink(resolveLocalPath(storageKey));
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "ENOENT") {
      return;
    }
    throw err;
  }
}

/**
 * Server-side copy (e.g. task clone).
 *
 * @param {string} sourceKey
 * @param {string} destKey
 */
export async function copyObject(sourceKey, destKey) {
  if (isS3Enabled()) {
    const encodedSourceKey = sourceKey
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/");
    await getClient().send(
      new CopyObjectCommand({
        Bucket: BUCKET,
        CopySource: `${BUCKET}/${encodedSourceKey}`,
        Key: destKey,
      }),
    );
    return;
  }

  const sourcePath = resolveLocalPath(sourceKey);
  const destPath = resolveLocalPath(destKey);
  await mkdir(path.dirname(destPath), { recursive: true });
  await copyFile(sourcePath, destPath);
}

/**
 * @param {import('node:http').IncomingMessage} req
 */
export async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * Serve a locally stored object (GET /api/local-storage/…).
 * @param {string} storageKey
 * @param {{ fileName?: string | null, inline?: boolean, contentType?: string | null }} [opts]
 */
export async function readLocalObjectResponse(storageKey, opts = {}) {
  const buf = await getObjectBuffer(storageKey);
  const fileName = opts.fileName ? sanitizeFileName(opts.fileName) : null;
  const disposition = opts.inline ? "inline" : "attachment";
  /** @type {Record<string, string | number>} */
  const headers = {
    "Content-Length": buf.length,
  };
  if (opts.contentType) {
    headers["Content-Type"] = opts.contentType;
  }
  if (fileName) {
    headers["Content-Disposition"] = `${disposition}; filename="${fileName}"`;
  } else if (opts.inline) {
    headers["Content-Disposition"] = "inline";
  }
  return { buf, headers };
}

/**
 * @param {string} pathname e.g. /api/local-storage/attachments/1/foo.jpg
 * @returns {string | null}
 */
export function storageKeyFromLocalPath(pathname) {
  const prefix = "/api/local-storage/";
  if (!pathname.startsWith(prefix)) return null;
  const encoded = pathname.slice(prefix.length);
  if (!encoded) return null;
  return encoded
    .split("/")
    .map((segment) => decodeURIComponent(segment))
    .join("/");
}
