import { getPool } from "./db.mjs";
import { formatAddressGeocodeQueries, mapWithConcurrency } from "./geocoding.mjs";
import { searchPlaceTopMatch } from "./places.mjs";

const DEFAULT_CONCURRENCY = 4;

/**
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {number} addressId
 * @param {number} latitude
 * @param {number} longitude
 * @param {string | null} googlePlaceId
 */
export async function persistAddressCoordinates(
  db,
  addressId,
  latitude,
  longitude,
  googlePlaceId,
) {
  await db.query(
    `UPDATE addresses
     SET latitude = $2,
         longitude = $3,
         google_place_id = $4
     WHERE id = $1
       AND deleted_at IS NULL`,
    [addressId, latitude, longitude, googlePlaceId],
  );

  await propagateAddressCoordsToTasks(db, addressId, latitude, longitude);
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {number} addressId
 * @param {number} latitude
 * @param {number} longitude
 */
export async function propagateAddressCoordsToTasks(
  db,
  addressId,
  latitude,
  longitude,
) {
  await db.query(
    `UPDATE tasks
     SET destination_latitude = $2,
         destination_longitude = $3,
         updated_at = now()
     WHERE destination_address_id = $1
       AND deleted_at IS NULL`,
    [addressId, latitude, longitude],
  );
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {number} taskId
 * @param {number} latitude
 * @param {number} longitude
 * @param {number | null | undefined} addressId
 */
export async function persistTaskDestinationCoordinates(
  db,
  taskId,
  latitude,
  longitude,
  addressId,
) {
  await db.query(
    `UPDATE tasks
     SET destination_latitude = $2,
         destination_longitude = $3,
         updated_at = now()
     WHERE id = $1
       AND deleted_at IS NULL`,
    [taskId, latitude, longitude],
  );

  if (addressId != null && Number.isInteger(addressId) && addressId > 0) {
    await persistAddressCoordinates(db, addressId, latitude, longitude, null);
  }
}

/**
 * @param {{ ids?: number[], limit?: number | null }} [opts]
 */
export async function loadAddressesMissingCoords(opts = {}) {
  const pool = getPool();
  const params = [];
  let limitClause = "";
  let idsClause = "";

  if (Array.isArray(opts.ids) && opts.ids.length > 0) {
    params.push(opts.ids);
    idsClause = `AND id = ANY($${params.length}::bigint[])`;
  }

  if (opts.limit != null && Number.isFinite(opts.limit) && opts.limit > 0) {
    params.push(Math.floor(opts.limit));
    limitClause = `LIMIT $${params.length}`;
  }

  const { rows } = await pool.query(
    `SELECT id, address_name, street_line, building
     FROM addresses
     WHERE deleted_at IS NULL
       AND (latitude IS NULL OR longitude IS NULL)
       ${idsClause}
     ORDER BY id
     ${limitClause}`,
    params,
  );

  return rows.map((row) => ({
    id: Number(row.id),
    addressName: row.address_name ?? "",
    streetLine: row.street_line ?? "",
    building: row.building ?? "",
  }));
}

/**
 * @param {number} addressId
 */
async function geocodeAddressRow(addressId) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT id, address_name, street_line, building
     FROM addresses
     WHERE id = $1
       AND deleted_at IS NULL`,
    [addressId],
  );
  if (rows.length === 0) {
    return { addressId, ok: false, reason: "Address not found" };
  }

  const row = rows[0];
  const queries = formatAddressGeocodeQueries({
    addressName: row.address_name,
    streetLine: row.street_line,
    building: row.building,
  });
  if (queries.length === 0) {
    return { addressId, ok: false, reason: "No address text to geocode" };
  }

  /** @type {Error | null} */
  let lastError = null;
  for (const query of queries) {
    try {
      const place = await searchPlaceTopMatch(query);
      await persistAddressCoordinates(
        pool,
        addressId,
        place.latitude,
        place.longitude,
        place.placeId,
      );
      return { addressId, ok: true, query, placeId: place.placeId };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error("Geocode failed");
      if (err && typeof err === "object" && err.status === 503) {
        throw err;
      }
    }
  }

  return {
    addressId,
    ok: false,
    reason: lastError?.message ?? "No matching place found",
  };
}

/**
 * @param {{ ids?: number[], limit?: number | null, concurrency?: number }} [opts]
 */
export async function geocodeAddressesBatch(opts = {}) {
  const rows = await loadAddressesMissingCoords({
    ids: opts.ids,
    limit: opts.limit ?? null,
  });
  const concurrency = opts.concurrency ?? DEFAULT_CONCURRENCY;

  const results = await mapWithConcurrency(rows, concurrency, async (row) =>
    geocodeAddressRow(row.id),
  );

  /** @type {{ addressId: number, reason: string }[]} */
  const failed = [];
  let geocoded = 0;

  for (const result of results) {
    if (result.ok) {
      geocoded += 1;
    } else {
      failed.push({
        addressId: result.addressId,
        reason: result.reason ?? "Geocode failed",
      });
    }
  }

  return {
    attempted: rows.length,
    geocoded,
    failed,
  };
}
