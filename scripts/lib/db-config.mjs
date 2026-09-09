/**
 * Shared PostgreSQL connection settings for the API and one-off scripts.
 * Local default: Docker Compose on host port 5433 (see docker-compose.yml).
 * Optional cloud: set DATABASE_URL or RDS_SECRET_ARN + PGHOST/PGUSER/PGDATABASE.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const envPath = resolve(root, ".env");

if (existsSync(envPath)) {
  const text = readFileSync(envPath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function isLocalHost(host) {
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

/**
 * @param {string} secretArn
 */
function fetchPasswordFromSecretsManager(secretArn) {
  const region = process.env.AWS_REGION || "us-west-1";
  let raw;
  try {
    raw = execFileSync(
      "aws",
      [
        "secretsmanager",
        "get-secret-value",
        "--region",
        region,
        "--secret-id",
        secretArn,
        "--query",
        "SecretString",
        "--output",
        "text",
      ],
      { encoding: "utf8" },
    ).trim();
  } catch (err) {
    const detail =
      err && typeof err === "object" && "stderr" in err
        ? String(err.stderr).trim()
        : err instanceof Error
          ? err.message
          : String(err);
    const expired = /session has expired|reauthenticate|Unable to locate credentials|ExpiredToken/i.test(
      detail,
    );
    const error = new Error(
      expired
        ? "AWS session expired — run `aws login`, then retry."
        : `Failed to fetch RDS password from Secrets Manager: ${detail || "unknown error"}`,
    );
    error.status = 503;
    throw error;
  }

  const parsed = JSON.parse(raw);
  if (!parsed.password) {
    throw new Error("Secrets Manager payload missing password");
  }
  return parsed.password;
}

/** @returns {string} */
export function resolvePassword() {
  if (process.env.PGPASSWORD) {
    return process.env.PGPASSWORD;
  }

  if (process.env.DATABASE_URL?.trim()) {
    try {
      const url = new URL(process.env.DATABASE_URL.trim());
      if (url.password) {
        return decodeURIComponent(url.password);
      }
    } catch {
      // Fall through.
    }
  }

  const secretArn = process.env.RDS_SECRET_ARN?.trim();
  if (secretArn) {
    return fetchPasswordFromSecretsManager(secretArn);
  }

  return "field";
}

/**
 * @returns {import("pg").PoolConfig}
 */
export function getPoolConfig() {
  if (process.env.DATABASE_URL?.trim()) {
    const connectionString = process.env.DATABASE_URL.trim();
    let ssl;
    try {
      const hostname = new URL(connectionString).hostname;
      ssl = isLocalHost(hostname)
        ? undefined
        : { rejectUnauthorized: false };
    } catch {
      ssl = { rejectUnauthorized: false };
    }
    return { connectionString, ssl, max: 5 };
  }

  const host = process.env.PGHOST || "localhost";
  const port = Number(process.env.PGPORT || 5433);
  const database = process.env.PGDATABASE || "field";
  const user = process.env.PGUSER || "field";
  const password = resolvePassword();
  const ssl = isLocalHost(host) ? undefined : { rejectUnauthorized: false };

  return { host, port, database, user, password, ssl, max: 5 };
}

/** @param {string} [password] */
export function createPgClientConfig(password = resolvePassword()) {
  const pool = getPoolConfig();
  if ("connectionString" in pool && pool.connectionString) {
    return {
      connectionString: pool.connectionString,
      ssl: pool.ssl,
    };
  }
  return {
    host: pool.host,
    port: pool.port,
    database: pool.database,
    user: pool.user,
    password,
    ssl: pool.ssl,
  };
}
