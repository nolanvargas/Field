import pg from "pg";
import { getPoolConfig } from "../scripts/lib/db-config.mjs";

/** @type {pg.Pool | null} */
let pool = null;

/** @type {pg.Pool | null} */
let testPoolOverride = null;

/**
 * Route all API queries through a test pool (e.g. a single client inside BEGIN).
 * @param {pg.Pool | null} override
 */
export function setTestPool(override) {
  testPoolOverride = override;
}

export function resetTestPool() {
  testPoolOverride = null;
}

export function getPool() {
  if (testPoolOverride) {
    return testPoolOverride;
  }
  if (!pool) {
    pool = new pg.Pool(getPoolConfig());
  }
  return pool;
}
