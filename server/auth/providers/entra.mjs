import { createRemoteJWKSet, jwtVerify } from "jose";
import { WEB_AUTH_PROVIDER_ENTRA } from "../../../shared/webAuthProviders.js";

export const id = WEB_AUTH_PROVIDER_ENTRA;

/**
 * @param {import("../../shared/webAuthConfig.js").ResolvedWebAuth} settings
 * @returns {boolean}
 */
export function isConfiguredWith(settings) {
  return (
    settings.provider === WEB_AUTH_PROVIDER_ENTRA &&
    settings.config != null &&
    Boolean(settings.config.clientId && settings.config.tenantId)
  );
}

/**
 * @param {import("../../shared/webAuthConfig.js").ResolvedWebAuth} settings
 * @returns {{ clientId: string, tenantId: string } | null}
 */
export function getPublicConfigFrom(settings) {
  if (!isConfiguredWith(settings)) return null;
  return settings.config;
}

/**
 * @param {string} tenantId
 */
function issuerForTenant(tenantId) {
  return `https://login.microsoftonline.com/${tenantId}/v2.0`;
}

/** @type {Map<string, ReturnType<typeof createRemoteJWKSet>>} */
const jwksByTenant = new Map();

/**
 * @param {string} tenantId
 */
function getJwks(tenantId) {
  let jwks = jwksByTenant.get(tenantId);
  if (!jwks) {
    jwks = createRemoteJWKSet(
      new URL(`https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`),
    );
    jwksByTenant.set(tenantId, jwks);
  }
  return jwks;
}

/**
 * @param {string} token
 * @param {import("../../shared/webAuthConfig.js").ResolvedWebAuth} settings
 * @returns {Promise<import("../verifiedIdentity.mjs").VerifiedIdentity>}
 */
export async function verifyToken(token, settings) {
  if (!isConfiguredWith(settings) || !settings.config) {
    throw Object.assign(new Error("Entra auth is not configured"), { status: 500 });
  }

  const { clientId, tenantId } = settings.config;
  const apiAudience = (process.env.AZURE_API_AUDIENCE ?? "").trim();
  const audiences = apiAudience ? [clientId, apiAudience] : [clientId];

  const { payload } = await jwtVerify(token, getJwks(tenantId), {
    issuer: issuerForTenant(tenantId),
    audience: audiences,
  });

  const subjectId = typeof payload.oid === "string" ? payload.oid : null;
  if (!subjectId) {
    throw Object.assign(new Error("Token missing oid claim"), { status: 401 });
  }

  const email =
    (typeof payload.preferred_username === "string" && payload.preferred_username) ||
    (typeof payload.email === "string" && payload.email) ||
    null;
  const name = typeof payload.name === "string" ? payload.name : null;

  return {
    subjectId,
    email,
    name,
    displayNameFallback: "Entra user",
  };
}
