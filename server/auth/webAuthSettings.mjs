import { getPool } from "../db.mjs";
import {
  WEB_AUTH_PROVIDER_ENTRA,
  WEB_AUTH_PROVIDER_STUB,
} from "../../shared/webAuthProviders.js";
import {
  envEntraWebAuthFallback,
  normalizeWebAuthProvider,
  resolveWebAuthFromParts,
} from "../../shared/webAuthConfig.js";

/** @typedef {import("../../shared/webAuthConfig.js").ResolvedWebAuth} ResolvedWebAuth */

const CACHE_TTL_MS = 30_000;

/** @type {{ data: ResolvedWebAuth | null, expiresAt: number }} */
const cache = { data: null, expiresAt: 0 };

export function invalidateWebAuthSettingsCache() {
  cache.data = null;
  cache.expiresAt = 0;
}

/**
 * @returns {Promise<ResolvedWebAuth>}
 */
export async function resolveWebAuthSettings() {
  const now = Date.now();
  if (cache.data && cache.expiresAt > now) {
    return cache.data;
  }

  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT web_auth_provider, web_auth_config
     FROM org_settings
     WHERE id = 1`,
  );
  const row = rows[0];
  const dbProvider = normalizeWebAuthProvider(row?.web_auth_provider);

  /** @type {ResolvedWebAuth} */
  let resolved;

  if (dbProvider === WEB_AUTH_PROVIDER_STUB) {
    resolved = { provider: WEB_AUTH_PROVIDER_STUB, config: null };
  } else if (dbProvider === WEB_AUTH_PROVIDER_ENTRA) {
    resolved = resolveWebAuthFromParts(
      WEB_AUTH_PROVIDER_ENTRA,
      row?.web_auth_config,
    );
    if (resolved.provider !== WEB_AUTH_PROVIDER_ENTRA) {
      throw Object.assign(
        new Error("Entra web auth is selected but client ID and tenant ID are required"),
        { status: 500 },
      );
    }
  } else {
    resolved = envEntraWebAuthFallback(process.env);
  }

  cache.data = resolved;
  cache.expiresAt = now + CACHE_TTL_MS;
  return resolved;
}
