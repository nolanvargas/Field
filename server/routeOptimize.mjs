/**
 * Google Routes waypoint optimization + multistop maps URLs.
 * Travel-time stop reordering only — not workforce assignment optimization.
 * Routes optimization may bill at Advanced tier; capped at 25 stops per request.
 */

import { getPool } from "./db.mjs";
import { getGoogleMapsApiKey, resolveTaskCoordinates } from "./geocoding.mjs";
import { buildMultistopMapsUrl, reorderStopsByOptimizedIndexes } from "./mapsUrls.mjs";

const ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";
const MAX_STOPS = 25;

/**
 * @param {unknown} value
 * @returns {number[]}
 */
function parseTaskIds(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw Object.assign(new Error("taskIds must be a non-empty array"), {
      status: 400,
    });
  }

  const ids = value.map((item) => Number(item));
  if (ids.some((id) => !Number.isInteger(id) || id < 1)) {
    throw Object.assign(new Error("taskIds must be positive integers"), {
      status: 400,
    });
  }

  const unique = [...new Set(ids)];
  if (unique.length > MAX_STOPS) {
    throw Object.assign(
      new Error(`At most ${MAX_STOPS} stops can be optimized per request`),
      { status: 400 },
    );
  }

  return unique;
}

/**
 * @param {'ios' | 'android' | 'web'} platform
 */
function normalizePlatform(platform) {
  if (platform === "ios" || platform === "android" || platform === "web") {
    return platform;
  }
  return "web";
}

/**
 * @param {number[]} taskIds
 * @returns {Promise<object[]>}
 */
async function loadTasksForRoute(taskIds) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT
       t.id,
       t.destination_address_id,
       t.destination_latitude,
       t.destination_longitude,
       a.latitude AS address_latitude,
       a.longitude AS address_longitude,
       COALESCE(t.destination_address_name, '') AS destination_address_name,
       COALESCE(t.destination_address, '') AS destination_address,
       COALESCE(t.destination_building, '') AS destination_building
     FROM tasks t
     LEFT JOIN addresses a
       ON a.id = t.destination_address_id
      AND a.deleted_at IS NULL
     WHERE t.deleted_at IS NULL
       AND t.id = ANY($1::bigint[])`,
    [taskIds],
  );

  const byId = new Map(rows.map((row) => [Number(row.id), row]));
  return taskIds
    .map((id) => byId.get(id))
    .filter((row) => row != null);
}

/**
 * @param {{ latitude: number, longitude: number }[]} points
 */
function centroid(points) {
  const sum = points.reduce(
    (acc, point) => ({
      latitude: acc.latitude + point.latitude,
      longitude: acc.longitude + point.longitude,
    }),
    { latitude: 0, longitude: 0 },
  );
  return {
    latitude: sum.latitude / points.length,
    longitude: sum.longitude / points.length,
  };
}

/**
 * @param {{
 *   latitude: number,
 *   longitude: number,
 * }[]} waypoints
 * @returns {Promise<number[]>}
 */
async function computeOptimizedIndexes(waypoints) {
  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) {
    throw Object.assign(
      new Error("Route optimization is not configured (GOOGLE_MAPS_API_KEY)"),
      { status: 503 },
    );
  }

  if (waypoints.length < 2) {
    return waypoints.map((_, index) => index);
  }

  if (waypoints.length === 2) {
    return [0];
  }

  const anchor = centroid(waypoints);
  const body = {
    origin: {
      location: {
        latLng: {
          latitude: anchor.latitude,
          longitude: anchor.longitude,
        },
      },
    },
    destination: {
      location: {
        latLng: {
          latitude: anchor.latitude,
          longitude: anchor.longitude,
        },
      },
    },
    intermediates: waypoints.map((point) => ({
      location: {
        latLng: {
          latitude: point.latitude,
          longitude: point.longitude,
        },
      },
    })),
    travelMode: "DRIVE",
    optimizeWaypointOrder: true,
  };

  const res = await fetch(ROUTES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "routes.optimizedIntermediateWaypointIndex",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw Object.assign(
      new Error(
        `Routes optimization failed (${res.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`,
      ),
      { status: 502 },
    );
  }

  const data = await res.json();
  const indexes = data?.routes?.[0]?.optimizedIntermediateWaypointIndex;
  if (!Array.isArray(indexes) || indexes.length !== waypoints.length) {
    throw Object.assign(new Error("Routes optimization returned an invalid order"), {
      status: 502,
    });
  }

  return indexes.map((index) => Number(index));
}

/**
 * @param {number} taskId
 * @param {object} row
 * @param {string} reason
 */
function logSkippedTask(taskId, row, reason) {
  const hasText = Boolean(
    String(row.destination_address ?? "").trim() ||
      String(row.destination_address_name ?? "").trim(),
  );
  console.warn(
    hasText
      ? `[routes] skipped task ${taskId}: ${reason}`
      : `[routes] skipped task ${taskId}: no destination address`,
  );
}

/**
 * @param {{ taskIds: unknown, platform?: unknown }} input
 */
export async function optimizeTaskRoute(input) {
  const taskIds = parseTaskIds(input?.taskIds);
  const platform = normalizePlatform(input?.platform);

  const rows = await loadTasksForRoute(taskIds);
  if (rows.length === 0) {
    throw Object.assign(new Error("No matching tasks found"), { status: 404 });
  }

  /** @type {{ taskId: number, reason: string }[]} */
  const skipped = [];
  /** @type {{ taskId: number, latitude: number, longitude: number }[]} */
  const resolved = [];

  for (const row of rows) {
    const taskId = Number(row.id);
    const coords = resolveTaskCoordinates(row);
    if (!coords) {
      const hasText = Boolean(
        String(row.destination_address ?? "").trim() ||
          String(row.destination_address_name ?? "").trim(),
      );
      const reason = hasText
        ? "Missing coordinates — use Geo-locate on the task"
        : "No destination address";
      logSkippedTask(taskId, row, reason);
      skipped.push({ taskId, reason });
      continue;
    }
    resolved.push({
      taskId,
      latitude: coords.lat,
      longitude: coords.lng,
    });
  }

  if (resolved.length < 2) {
    const skipSummary = skipped
      .map((item) => `#${item.taskId}: ${item.reason}`)
      .join("; ");
    const message = skipSummary
      ? `At least two tasks with geocodable destinations are required (${skipSummary})`
      : "At least two tasks with geocodable destinations are required";
    throw Object.assign(new Error(message), { status: 400 });
  }

  const anchor = centroid(resolved);
  const optimizedIndexes = await computeOptimizedIndexes(resolved);
  const orderedStops = reorderStopsByOptimizedIndexes(
    resolved,
    optimizedIndexes,
    anchor,
    anchor,
  );

  const mapsUrl = buildMultistopMapsUrl(orderedStops, platform);

  return {
    orderedTaskIds: orderedStops.map((stop) => stop.taskId),
    mapsUrl,
    skipped,
  };
}
