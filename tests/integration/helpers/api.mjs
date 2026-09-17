/**
 * Spin up the Field API on an ephemeral port for integration tests.
 */
import { createApiServer } from "../../../server/index.mjs";
import { testUserBearerToken } from "../../../server/auth.mjs";

/**
 * @typedef {{
 *   baseUrl: string,
 *   port: number,
 *   fetch: (path: string, init?: RequestInit) => Promise<Response>,
 *   authFetch: (userId: string, path: string, init?: RequestInit) => Promise<Response>,
 *   deviceFetch: (token: string, path: string, init?: RequestInit) => Promise<Response>,
 *   close: () => Promise<void>,
 * }} TestApi
 */

/**
 * @returns {Promise<TestApi>}
 */
export async function startTestApi() {
  process.env.FIELD_API_REQUIRE_AUTH = "1";

  const server = createApiServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  const port =
    address && typeof address === "object" && "port" in address
      ? address.port
      : 0;
  const baseUrl = `http://127.0.0.1:${port}`;

  /**
   * @param {string} path
   * @param {RequestInit} [init]
   */
  async function apiFetch(path, init = {}) {
    const headers = new Headers(init.headers);
    if (init.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    return fetch(`${baseUrl}${path}`, { ...init, headers });
  }

  return {
    baseUrl,
    port,
    fetch: apiFetch,
    authFetch(userId, path, init = {}) {
      const headers = new Headers(init.headers);
      headers.set("Authorization", `Bearer ${testUserBearerToken(userId)}`);
      return apiFetch(path, { ...init, headers });
    },
    deviceFetch(token, path, init = {}) {
      const headers = new Headers(init.headers);
      headers.set("Authorization", `Bearer ${token}`);
      return apiFetch(path, { ...init, headers });
    },
    close() {
      return new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    },
  };
}
