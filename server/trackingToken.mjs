/**
 * Tracking tokens for customer-facing /t/:token pages.
 */
import { randomBytes } from "node:crypto";

/** @returns {string} base64url token (43 chars for 32 bytes) */
export function generateTrackingToken() {
  return randomBytes(32).toString("base64url");
}

/**
 * @param {string} token
 * @returns {string} path only, e.g. /t/abc…
 */
export function trackingPath(token) {
  const t = typeof token === "string" ? token.trim() : "";
  return t ? `/t/${t}` : "";
}

/**
 * Absolute URL when PUBLIC_APP_URL is set; otherwise the path.
 * @param {string} token
 */
export function trackingUrl(token) {
  const path = trackingPath(token);
  if (!path) return "";
  const base = (process.env.PUBLIC_APP_URL ?? "").trim().replace(/\/$/, "");
  return base ? `${base}${path}` : path;
}
