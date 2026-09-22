import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { readOrgLogoBuffer } from "./orgLogo.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const LOGO_SVG_PATH = path.join(ROOT, "public", "logo.svg");

/** @type {Promise<string> | null} */
let fieldLogoPngDataUriPromise = null;

export function companyName() {
  return (process.env.COMPANY_NAME ?? "").trim();
}

export function companySupportEmail() {
  return (process.env.COMPANY_SUPPORT_EMAIL ?? "").trim();
}

export function emailFromAddress() {
  return (process.env.EMAIL_FROM ?? "").trim();
}

/**
 * PNG data URI for the Field product mark (emails / PDF fallback).
 * @returns {Promise<string>}
 */
export async function getFieldLogoDataUri() {
  if (!fieldLogoPngDataUriPromise) {
    fieldLogoPngDataUriPromise = readFile(LOGO_SVG_PATH)
      .then((svg) => sharp(svg).resize(200).png().toBuffer())
      .then((buf) => `data:image/png;base64,${buf.toString("base64")}`);
  }
  return fieldLogoPngDataUriPromise;
}

/**
 * PNG buffer for the Field product mark (PDF fallback).
 * @returns {Promise<Buffer>}
 */
export async function getFieldLogoPngBuffer() {
  const svg = await readFile(LOGO_SVG_PATH);
  return sharp(svg).resize(200).png().toBuffer();
}

/** @deprecated Use getFieldLogoDataUri */
export function getLogoDataUri() {
  return getFieldLogoDataUri();
}

/** @deprecated Use getFieldLogoPngBuffer */
export async function getLogoPngBuffer() {
  return getFieldLogoPngBuffer();
}

/**
 * @param {Buffer} buffer
 * @returns {Promise<string>}
 */
async function orgLogoBufferToDataUri(buffer) {
  const png = await sharp(buffer).resize(400, 400, { fit: "inside" }).png().toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
}

/**
 * @param {Buffer} buffer
 * @returns {Promise<Buffer>}
 */
async function orgLogoBufferToPng(buffer) {
  return sharp(buffer).resize(400, 400, { fit: "inside" }).png().toBuffer();
}

/**
 * Org logo as a PNG data URI when configured.
 * @returns {Promise<string | null>}
 */
export async function getOrgLogoDataUri() {
  const buffer = await readOrgLogoBuffer();
  if (!buffer) return null;
  return orgLogoBufferToDataUri(buffer);
}

/**
 * Org logo as a PNG buffer when configured.
 * @returns {Promise<Buffer | null>}
 */
export async function getOrgLogoPngBuffer() {
  const buffer = await readOrgLogoBuffer();
  if (!buffer) return null;
  return orgLogoBufferToPng(buffer);
}

/**
 * Primary brand mark for customer-facing surfaces: org logo when set, else Field mark.
 * @returns {Promise<string>}
 */
export async function resolveBrandLogoDataUri() {
  const orgDataUri = await getOrgLogoDataUri();
  if (orgDataUri) return orgDataUri;
  return getFieldLogoDataUri();
}

/**
 * Primary brand mark for PDF headers: org logo when set, else Field mark.
 * @returns {Promise<Buffer>}
 */
export async function resolveBrandLogoPngBuffer() {
  const orgBuf = await getOrgLogoPngBuffer();
  if (orgBuf) return orgBuf;
  return getFieldLogoPngBuffer();
}

/**
 * @param {string} dataUri
 * @param {string} [alt]
 * @returns {string}
 */
export function buildEmailBrandBarHtml(dataUri, alt = "") {
  const safeAlt = alt.replace(/"/g, "&quot;");
  return `<img
									src="${dataUri}"
									alt="${safeAlt}"
									style="
										display: block;
										max-width: 240px;
										max-height: 42px;
										width: auto;
										height: auto;
										border: 0;
										outline: none;
										text-decoration: none;
									"
								/>`;
}
