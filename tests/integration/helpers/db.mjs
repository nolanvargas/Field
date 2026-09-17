/**
 * Postgres helpers for API integration tests.
 */
import pg from "pg";
import { createPgClient } from "../../../scripts/lib/db.mjs";
import { resetTestPool, setTestPool } from "../../../server/db.mjs";

/**
 * @param {(client: pg.Client) => Promise<void>} testFn
 */
export async function withTransaction(testFn) {
  const client = createPgClient();
  await client.connect();
  await client.query("BEGIN");

  /** @type {pg.Pool} */
  const pool = {
    query: (...args) => client.query(...args),
    connect: async () => ({
      query: (...args) => client.query(...args),
      release: () => {},
    }),
    end: async () => {},
  };

  setTestPool(pool);
  try {
    await testFn(client);
  } finally {
    resetTestPool();
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore
    }
    await client.end();
  }
}

/**
 * @param {(client: pg.Client) => Promise<void>} testFn
 */
export async function withCommittedDb(testFn) {
  const client = createPgClient();
  await client.connect();
  try {
    await testFn(client);
  } finally {
    await client.end();
  }
}

/**
 * @returns {Promise<boolean>}
 */
export async function isPostgresReachable() {
  const client = createPgClient();
  try {
    await client.connect();
    await client.query("SELECT 1");
    return true;
  } catch {
    return false;
  } finally {
    try {
      await client.end();
    } catch {
      // ignore
    }
  }
}
