/**
 * Write minimal attachment/document files for Sandbocks task seed data.
 * Several storage keys per file type share the same tiny fixture bytes.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	curatedAttachmentByteSize,
	pickCuratedAttachmentStorageKey,
} from "../../shared/curatedAttachmentPool.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORAGE_ROOT = path.resolve(__dirname, "..", "..", "storage");

/** @param {number} n @param {string} ext @param {string} [prefix] */
function seedPaths(n, ext, prefix = "seed") {
  return Array.from(
    { length: n },
    (_, i) => `attachments/seed/${prefix}-${i + 1}.${ext}`,
  );
}

/** @param {number} n @param {string} name */
function seedDocPaths(n, name) {
  return Array.from(
    { length: n },
    (_, i) => `documents/seed/${name}-${i + 1}.pdf`,
  );
}

/** Typed fixture pools — many DB rows, few on-disk files. */
export const SEED_POOLS = {
  photos: seedPaths(5, "jpg", "photo"),
  pdfs: seedPaths(5, "pdf", "doc"),
  gifs: seedPaths(4, "gif", "signoff"),
  videos: seedPaths(4, "mp4", "clip"),
  dockets: seedDocPaths(4, "delivery-docket"),
  labels: seedDocPaths(3, "shipping-label"),
};

/** Back-compat aliases for hand-authored seed rows. */
export const EXISTING = {
  photo: SEED_POOLS.photos[0],
  pdf: SEED_POOLS.pdfs[0],
  gif: SEED_POOLS.gifs[0],
  video: SEED_POOLS.videos[0],
  docket: SEED_POOLS.dockets[0],
};

const PHOTO_BYTES = Buffer.from(
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA//2Q==",
  "base64",
);
const PDF_BYTES = Buffer.from(
  "JVBERi0xLjMKJcTl8uXrp/Og0MTGCjQgMCBvYmoKPDwgL1R5cGUgL0NhdGFsb2cgL1BhZ2VzIDIgMCBSID4+CmVuZG9iagoKMiAwIG9iago8PCAvVHlwZSAvUGFnZXMgL0tpZHMgWzMgMCBSXSAvQ291bnQgMSA+PgplbmRvYmoKCjMgMCBvYmoKPDwgL1R5cGUgL3BhZ2UgL01lZGlhQm94IFswIDAgMyAzXSA+PgplbmRvYmoKeHJlZgowIDQKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDA5IDAwMDAwIG4gCjAwMDAwMDAwNTIgMDAwMDAgbiAKMDAwMDAwMDEwMSAwMDAwMCBuIAp0cmFpbGVyCjw8IC9TaXplIDQgL1Jvb3QgMSAwIFIgPj4Kc3RhcnR4cmVmCjE0OQolJUVPRgo=",
  "base64",
);
const GIF_BYTES = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);
const VIDEO_BYTES = Buffer.from(
  "AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAAAptZGF0AAAAAAAA",
  "base64",
);

/** @param {string[]} keys @param {Buffer} body */
function mapKeys(keys, body) {
  /** @type {Record<string, Buffer>} */
  const out = {};
  for (const key of keys) out[key] = body;
  return out;
}

/** @type {Record<string, Buffer>} */
const FIXTURES = {
  ...mapKeys(SEED_POOLS.photos, PHOTO_BYTES),
  ...mapKeys(SEED_POOLS.pdfs, PDF_BYTES),
  ...mapKeys(SEED_POOLS.gifs, GIF_BYTES),
  ...mapKeys(SEED_POOLS.videos, VIDEO_BYTES),
  ...mapKeys(SEED_POOLS.dockets, PDF_BYTES),
  ...mapKeys(SEED_POOLS.labels, PDF_BYTES),
};

/** @type {Map<string, number>} */
const byteSizes = new Map(
  Object.entries(FIXTURES).map(([key, buf]) => [key, buf.length]),
);

/**
 * @param {string} kind
 * @param {number} seed
 */
export function pickSeedStorageKey(kind, seed) {
  return pickCuratedAttachmentStorageKey(kind, seed);
}

/**
 * @param {string} storageKey
 */
export function seedStorageByteSize(storageKey) {
  return curatedAttachmentByteSize(storageKey) ?? byteSizes.get(storageKey) ?? null;
}

/** @returns {string[]} */
export function allSeedStorageKeys() {
  return Object.keys(FIXTURES);
}

/**
 * @param {string} storageKey
 * @param {Buffer} body
 */
async function writeSeedFile(storageKey, body) {
  const relative = String(storageKey).replace(/^[/\\]+/, "");
  if (!relative || relative.includes("..")) {
    throw new Error(`Invalid seed storage key: ${storageKey}`);
  }
  const fullPath = path.join(STORAGE_ROOT, relative);
  const dir = path.dirname(fullPath);
  if (!fullPath.startsWith(STORAGE_ROOT)) {
    throw new Error(`Invalid seed storage key: ${storageKey}`);
  }
  await mkdir(dir, { recursive: true });
  await writeFile(fullPath, body);
}

/** Copy seed fixture pool into ./storage for local downloads. */
export async function writeSeedStorageFiles() {
  for (const [storageKey, body] of Object.entries(FIXTURES)) {
    await writeSeedFile(storageKey, body);
  }
}
