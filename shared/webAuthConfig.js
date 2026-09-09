import {
  WEB_AUTH_PROVIDER_ENTRA,
  WEB_AUTH_PROVIDER_STUB,
} from "./webAuthProviders.js";

/**
 * @typedef {{ clientId: string, tenantId: string }} EntraWebAuthConfig
 * @typedef {{
 *   provider: typeof WEB_AUTH_PROVIDER_STUB | typeof WEB_AUTH_PROVIDER_ENTRA,
 *   config: EntraWebAuthConfig | null,
 * }} ResolvedWebAuth
 */

/**
 * @param {unknown} value
 * @returns {typeof WEB_AUTH_PROVIDER_STUB | typeof WEB_AUTH_PROVIDER_ENTRA | null}
 */
export function normalizeWebAuthProvider(value) {
  const s = String(value ?? "").trim();
  if (s === WEB_AUTH_PROVIDER_ENTRA) return WEB_AUTH_PROVIDER_ENTRA;
  if (s === WEB_AUTH_PROVIDER_STUB) return WEB_AUTH_PROVIDER_STUB;
  return null;
}

/**
 * @param {unknown} raw
 * @returns {EntraWebAuthConfig}
 */
export function normalizeEntraWebAuthConfig(raw) {
  if (!raw || typeof raw !== "object") {
    return { clientId: "", tenantId: "" };
  }
  const row = /** @type {Record<string, unknown>} */ (raw);
  return {
    clientId: String(row.clientId ?? "").trim(),
    tenantId: String(row.tenantId ?? "").trim(),
  };
}

/**
 * @param {EntraWebAuthConfig} config
 * @returns {boolean}
 */
export function isEntraWebAuthConfigComplete(config) {
  return Boolean(config.clientId && config.tenantId);
}

/**
 * @param {typeof WEB_AUTH_PROVIDER_STUB | typeof WEB_AUTH_PROVIDER_ENTRA | null} provider
 * @param {unknown} config
 * @returns {ResolvedWebAuth}
 */
export function resolveWebAuthFromParts(provider, config) {
  const entraConfig = normalizeEntraWebAuthConfig(config);
  if (
    provider === WEB_AUTH_PROVIDER_ENTRA &&
    isEntraWebAuthConfigComplete(entraConfig)
  ) {
    return { provider: WEB_AUTH_PROVIDER_ENTRA, config: entraConfig };
  }
  return { provider: WEB_AUTH_PROVIDER_STUB, config: null };
}

/**
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} env
 * @returns {ResolvedWebAuth}
 */
export function envEntraWebAuthFallback(env) {
  const clientId = String(env.AZURE_CLIENT_ID ?? "").trim();
  const tenantId = String(env.AZURE_TENANT_ID ?? "").trim();
  if (!clientId || !tenantId) {
    return { provider: WEB_AUTH_PROVIDER_STUB, config: null };
  }
  return resolveWebAuthFromParts(WEB_AUTH_PROVIDER_ENTRA, {
    clientId,
    tenantId,
  });
}

/**
 * @param {unknown} raw
 * @returns {'env' | typeof WEB_AUTH_PROVIDER_STUB | typeof WEB_AUTH_PROVIDER_ENTRA}
 */
export function webAuthSourceFromDb(raw) {
  const provider = normalizeWebAuthProvider(raw);
  if (provider === WEB_AUTH_PROVIDER_ENTRA) return WEB_AUTH_PROVIDER_ENTRA;
  if (provider === WEB_AUTH_PROVIDER_STUB) return WEB_AUTH_PROVIDER_STUB;
  return "env";
}

/**
 * @param {'env' | typeof WEB_AUTH_PROVIDER_STUB | typeof WEB_AUTH_PROVIDER_ENTRA} source
 * @returns {typeof WEB_AUTH_PROVIDER_STUB | typeof WEB_AUTH_PROVIDER_ENTRA | null}
 */
export function webAuthProviderForDb(source) {
  if (source === WEB_AUTH_PROVIDER_ENTRA) return WEB_AUTH_PROVIDER_ENTRA;
  if (source === WEB_AUTH_PROVIDER_STUB) return WEB_AUTH_PROVIDER_STUB;
  return null;
}
