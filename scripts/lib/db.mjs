/**
 * Shared PostgreSQL connection helpers for one-off scripts.
 */
import pg from "pg";
import { createPgClientConfig, resolvePassword } from "./db-config.mjs";

export { resolvePassword as getPassword };

/** @param {string} [password] */
export function createPgClient(password = resolvePassword()) {
  const config = createPgClientConfig(password);
  return new pg.Client(config);
}
