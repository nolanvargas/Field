import pg from "pg";
import { getPoolConfig } from "../scripts/lib/db-config.mjs";

/** @type {pg.Pool | null} */
let pool = null;

export function getPool() {
  if (!pool) {
    pool = new pg.Pool(getPoolConfig());
  }
  return pool;
}
