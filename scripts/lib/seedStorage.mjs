/**
 * Write minimal attachment/document files for Sandbocks task seed data.
 * Paths match storage_key values in scripts/seed-dev-tasks.mjs.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORAGE_ROOT = path.resolve(__dirname, "..", "..", "storage");

/** Existing storage keys referenced by seed task rows. */
export const EXISTING = {
  photo:
    "attachments/1/0c5651fc-cb20-4e66-a9ca-88b79f9aa39f-20260514_094425.jpg",
  pdf: "attachments/1/b0876336-13e6-40d0-9b89-1d8c776ce18d-Bid Invitation.pdf",
  gif: "attachments/1/9538604d-653f-4857-bc65-45ef464a43c6-tr88d0xjf67g1.gif",
  video:
    "attachments/10308514/a223ebcd-50a6-4c8d-a5c9-9a465f84581c-20260724_083332.mp4",
  docket: "documents/delivery-docket-12192921.pdf",
};

/** @type {Record<string, Buffer>} */
const FIXTURES = {
  [EXISTING.photo]: Buffer.from(
    "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA//2Q==",
    "base64",
  ),
  [EXISTING.pdf]: Buffer.from(
    "JVBERi0xLjMKJcTl8uXrp/Og0MTGCjQgMCBvYmoKPDwgL1R5cGUgL0NhdGFsb2cgL1BhZ2VzIDIgMCBSID4+CmVuZG9iagoKMiAwIG9iago8PCAvVHlwZSAvUGFnZXMgL0tpZHMgWzMgMCBSXSAvQ291bnQgMSA+PgplbmRvYmoKCjMgMCBvYmoKPDwgL1R5cGUgL3BhZ2UgL01lZGlhQm94IFswIDAgMyAzXSA+PgplbmRvYmoKeHJlZgowIDQKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDA5IDAwMDAwIG4gCjAwMDAwMDAwNTIgMDAwMDAgbiAKMDAwMDAwMDEwMSAwMDAwMCBuIAp0cmFpbGVyCjw8IC9TaXplIDQgL1Jvb3QgMSAwIFIgPj4Kc3RhcnR4cmVmCjE0OQolJUVPRgo=",
    "base64",
  ),
  [EXISTING.gif]: Buffer.from(
    "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
    "base64",
  ),
  [EXISTING.video]: Buffer.from(
    "AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAAAptZGF0AAAAAAAA",
    "base64",
  ),
  [EXISTING.docket]: Buffer.from(
    "JVBERi0xLjMKJcTl8uXrp/Og0MTGCjQgMCBvYmoKPDwgL1R5cGUgL0NhdGFsb2cgL1BhZ2VzIDIgMCBSID4+CmVuZG9iagoKMiAwIG9iago8PCAvVHlwZSAvUGFnZXMgL0tpZHMgWzMgMCBSXSAvQ291bnQgMSA+PgplbmRvYmoKCjMgMCBvYmoKPDwgL1R5cGUgL3BhZ2UgL01lZGlhQm94IFswIDAgMyAzXSA+PgplbmRvYmoKeHJlZgowIDQKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDA5IDAwMDAwIG4gCjAwMDAwMDAwNTIgMDAwMDAgbiAKMDAwMDAwMDEwMSAwMDAwMCBuIAp0cmFpbGVyCjw8IC9TaXplIDQgL1Jvb3QgMSAwIFIgPj4Kc3RhcnR4cmVmCjE0OQolJUVPRgo=",
    "base64",
  ),
};

/** @type {Map<string, number>} */
const byteSizes = new Map(
  Object.entries(FIXTURES).map(([key, buf]) => [key, buf.length]),
);

/**
 * @param {string} storageKey
 */
export function seedStorageByteSize(storageKey) {
  return byteSizes.get(storageKey) ?? null;
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

/** Copy seed fixtures into ./storage for local downloads. */
export async function writeSeedStorageFiles() {
  for (const [storageKey, body] of Object.entries(FIXTURES)) {
    await writeSeedFile(storageKey, body);
  }
}
