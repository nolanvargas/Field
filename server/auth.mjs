import {
  PERMISSIONS,
  assertPermission,
} from "./permissions.mjs";
import {
  assertUserAssignedToTask,
  userCanViewAllTasks,
} from "./taskAccess.mjs";
import {
  looksLikeJwt,
  verifyDeviceSessionToken,
} from "./mobileAuth.mjs";
import { upsertUserFromVerifiedIdentity } from "./auth/verifiedIdentity.mjs";
import {
  getActiveWebAuthProvider,
  getWebAuthPublicConfig,
  isWebAuthEnabled,
  verifyWebToken,
} from "./auth/webAuth.mjs";

export { PERMISSIONS };
export {
  getActiveWebAuthProvider,
  getWebAuthPublicConfig,
  isWebAuthEnabled,
  verifyWebToken,
};
export { upsertUserFromVerifiedIdentity };

export const TEST_USER_BEARER_PREFIX = "test-user:";

/**
 * Integration tests set FIELD_API_REQUIRE_AUTH=1 so Bearer tokens are required
 * even when the org web auth provider is stub.
 * @returns {boolean}
 */
export function isApiAuthRequired() {
  const raw = process.env.FIELD_API_REQUIRE_AUTH;
  return raw === "1" || raw === "true";
}

/**
 * @param {string} userId
 * @returns {string}
 */
export function testUserBearerToken(userId) {
  return `${TEST_USER_BEARER_PREFIX}${userId}`;
}

/**
 * @param {string} pathname
 */
export function isAuthExemptPath(pathname) {
  if (pathname === "/api/health") return true;
  if (pathname === "/api/auth/config") return true;
  if (pathname === "/api/mobile/activate") return true;
  if (pathname.startsWith("/api/tracking/")) return true;
  if (pathname === "/api/org/logo") return true;
  return false;
}

/**
 * @param {import('node:http').IncomingMessage} req
 * @returns {string | null}
 */
export function getBearerToken(req) {
  const header = req.headers.authorization;
  if (!header || typeof header !== "string") return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

/**
 * When web auth is enabled, require a valid Bearer token (web IdP JWT or mobile
 * device session), except exempt paths. Attaches `req.auth` on success.
 * @param {import('node:http').IncomingMessage} req
 * @param {string} pathname
 */
export async function requireWebAuth(req, pathname) {
  const authRequired = (await isWebAuthEnabled()) || isApiAuthRequired();
  if (!authRequired) {
    return null;
  }
  if (isAuthExemptPath(pathname)) {
    return null;
  }

  const token = getBearerToken(req);
  if (!token) {
    throw Object.assign(new Error("Unauthorized"), { status: 401 });
  }

  if (!looksLikeJwt(token)) {
    if (
      isApiAuthRequired() &&
      token.startsWith(TEST_USER_BEARER_PREFIX)
    ) {
      const userId = token.slice(TEST_USER_BEARER_PREFIX.length).trim();
      if (!userId) {
        throw Object.assign(new Error("Unauthorized"), { status: 401 });
      }
      // @ts-ignore attach auth context for handlers
      req.auth = { userId };
      return { userId };
    }

    const device = await verifyDeviceSessionToken(token);
    // @ts-ignore attach auth context for handlers
    req.auth = {
      userId: device.userId,
      deviceSession: device,
    };
    return device;
  }

  try {
    const identity = await verifyWebToken(token);
    // @ts-ignore attach auth context for handlers
    req.auth = { userId: identity.subjectId, identity };
    return identity;
  } catch (err) {
    if (err && typeof err === "object" && "status" in err) throw err;
    const message = err instanceof Error ? err.message : "Invalid token";
    throw Object.assign(new Error(message), { status: 401 });
  }
}

/**
 * @param {{ auth?: { deviceSession?: { userId: string } | null } | null }} req
 * @returns {boolean}
 */
export function isDeviceSession(req) {
  return Boolean(req.auth?.deviceSession);
}

/**
 * Privileged org configuration requires an IdP-verified identity, not a QR device session.
 * @param {{ auth?: { deviceSession?: unknown, identity?: unknown } | null }} req
 */
export function assertRequiresIdpIdentity(req) {
  if (!isDeviceSession(req)) return;
  throw Object.assign(
    new Error("This action requires signing in with your organization account"),
    { status: 403 },
  );
}

/**
 * @param {{ auth?: { identity?: unknown, deviceSession?: { userId: string }, userId?: string } | null }} req
 * @returns {Promise<string | null>}
 */
export async function resolveAuthenticatedUserId(req) {
  const auth = req.auth;
  if (auth?.identity) {
    const user = await upsertUserFromVerifiedIdentity(
      /** @type {import("./auth/verifiedIdentity.mjs").VerifiedIdentity} */ (
        auth.identity
      ),
    );
    return user.id;
  }
  if (auth?.deviceSession && typeof auth.deviceSession.userId === "string") {
    const id = auth.deviceSession.userId.trim();
    return id || null;
  }
  if (auth && typeof auth.userId === "string" && auth.userId.trim()) {
    return auth.userId.trim();
  }
  return null;
}

/**
 * Permission keys apply on any platform (web or mobile device session).
 * @param {{ auth?: unknown }} req
 * @param {string} key
 * @returns {Promise<string>}
 */
export async function assertAuthenticatedPermission(req, key) {
  const actorUserId = await resolveAuthenticatedUserId(req);
  if (!actorUserId) {
    throw Object.assign(new Error("Unauthorized"), { status: 401 });
  }
  await assertPermission(actorUserId, key);
  return actorUserId;
}

/**
 * Resolve the acting user for task mutation endpoints.
 *
 * A mobile device session is authoritative: the session's userId is the only
 * identity the server trusts for the request, so caller-supplied
 * `crewMemberId` / `body.userId` are ignored. Web (IdP JWT) and dev (no
 * auth) requests return null, preserving the caller-declared userId path.
 *
 * @param {{ auth?: { deviceSession?: { userId: string } | null } | null }} req
 * @returns {{ userId: string, kind: 'device' } | null}
 */
export function resolveTaskActor(req) {
  const device = req.auth?.deviceSession;
  if (device && typeof device.userId === "string" && device.userId.trim()) {
    return { userId: device.userId.trim(), kind: "device" };
  }
  return null;
}

/**
 * Device sessions may only perform crew-action writes on assigned tasks.
 * @param {{ auth?: { deviceSession?: { userId: string } | null } | null }} req
 * @param {number} taskId
 */
export async function assertTaskActorForMutation(req, taskId) {
  const actor = resolveTaskActor(req);
  if (!actor) return;
  await assertUserAssignedToTask(actor.userId, taskId);
}

/**
 * @param {URLSearchParams} searchParams
 */
export function resolveTaskListFilters(searchParams) {
  return {
    crewMemberId: (searchParams.get("crewMemberId") ?? "").trim() || null,
    createdByUserId: (searchParams.get("createdByUserId") ?? "").trim() || null,
  };
}

/**
 * Scope task list queries to what the caller may see.
 * @param {import('node:http').IncomingMessage} req
 * @param {URLSearchParams} searchParams
 */
export async function resolveScopedTaskListFilters(req, searchParams) {
  const device = req.auth?.deviceSession;
  if (device && typeof device.userId === "string" && device.userId.trim()) {
    const userId = device.userId.trim();
    return {
      crewMemberId: userId,
      createdByUserId: userId,
    };
  }

  const actorUserId = await resolveAuthenticatedUserId(req);
  if (actorUserId) {
    if (!(await userCanViewAllTasks(actorUserId))) {
      return {
        crewMemberId: actorUserId,
        createdByUserId: actorUserId,
      };
    }
    return resolveTaskListFilters(searchParams);
  }

  return resolveTaskListFilters(searchParams);
}
