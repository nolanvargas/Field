import { WEB_AUTH_PROVIDER_STUB } from "../../shared/webAuthProviders.js";
import { resolveWebAuthSettings } from "./webAuthSettings.mjs";
import * as entra from "./providers/entra.mjs";

/** @type {Record<string, typeof entra>} */
const providers = {
  [entra.id]: entra,
};

/**
 * @returns {Promise<import("../../shared/webAuthProviders.js").WebAuthProviderId | string>}
 */
export async function getActiveWebAuthProvider() {
  const settings = await resolveWebAuthSettings();
  return settings.provider;
}

/**
 * @returns {Promise<boolean>}
 */
export async function isWebAuthEnabled() {
  const provider = await getActiveWebAuthProvider();
  return provider !== WEB_AUTH_PROVIDER_STUB;
}

/**
 * Public auth settings for the web client (no secrets).
 * @returns {Promise<{ provider: string, config: Record<string, string> | null }>}
 */
export async function getWebAuthPublicConfig() {
  const settings = await resolveWebAuthSettings();
  if (settings.provider === WEB_AUTH_PROVIDER_STUB) {
    return { provider: settings.provider, config: null };
  }
  const mod = providers[settings.provider];
  if (!mod) {
    return { provider: WEB_AUTH_PROVIDER_STUB, config: null };
  }
  return {
    provider: settings.provider,
    config: mod.getPublicConfigFrom(settings),
  };
}

/**
 * @param {string} token
 * @returns {Promise<import("./verifiedIdentity.mjs").VerifiedIdentity>}
 */
export async function verifyWebToken(token) {
  const settings = await resolveWebAuthSettings();
  if (settings.provider === WEB_AUTH_PROVIDER_STUB) {
    throw Object.assign(new Error("Web auth is not configured"), { status: 503 });
  }
  const mod = providers[settings.provider];
  if (!mod) {
    throw Object.assign(new Error(`Unknown web auth provider: ${settings.provider}`), {
      status: 500,
    });
  }
  return mod.verifyToken(token, settings);
}
