import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { SANDBOCKS } from "../shared/officialOrgs.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const LOGO_SVG_PATH = path.join(ROOT, "public", "logo.svg");

/** @type {Promise<string> | null} */
let logoPngDataUriPromise = null;

export function companyName() {
  return (process.env.COMPANY_NAME ?? SANDBOCKS.displayName).trim() || SANDBOCKS.displayName;
}

export function companySupportEmail() {
  return (
    (process.env.COMPANY_SUPPORT_EMAIL ?? "support@example.com").trim() ||
    "support@example.com"
  );
}

export function emailFromAddress() {
  return (process.env.EMAIL_FROM ?? "noreply@example.com").trim() || "noreply@example.com";
}

/**
 * PNG data URI for HTML emails (logo.svg rendered at 2x for retina).
 * @returns {Promise<string>}
 */
export function getLogoDataUri() {
  if (!logoPngDataUriPromise) {
    logoPngDataUriPromise = readFile(LOGO_SVG_PATH)
      .then((svg) => sharp(svg).resize(200).png().toBuffer())
      .then((buf) => `data:image/png;base64,${buf.toString("base64")}`);
  }
  return logoPngDataUriPromise;
}

/**
 * PNG buffer for PDF embedding (logo.svg).
 * @returns {Promise<Buffer>}
 */
export async function getLogoPngBuffer() {
  const svg = await readFile(LOGO_SVG_PATH);
  return sharp(svg).resize(200).png().toBuffer();
}
