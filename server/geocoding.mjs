const GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json";

/**
 * @param {string | null | undefined} value
 */
function trim(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Street + optional building — used for geocoding (not display).
 *
 * @param {{
 *   destination_address?: string | null,
 *   destination_building?: string | null,
 * }} row
 * @returns {string}
 */
export function formatTaskStreetQuery(row) {
  const street = trim(row.destination_address);
  const building = trim(row.destination_building);
  if (street && building) return `${street}, ${building}`;
  return street || building || "";
}

/**
 * Geocode queries to try, most reliable first. Street numbers resolve consistently;
 * venue names often match a different registered address (e.g. business HQ).
 *
 * @param {{
 *   destination_address_name?: string | null,
 *   destination_address?: string | null,
 *   destination_building?: string | null,
 * }} row
 * @returns {string[]}
 */
export function formatTaskGeocodeQueries(row) {
  const venue = trim(row.destination_address_name);
  const street = trim(row.destination_address);
  const building = trim(row.destination_building);
  const streetWithBuilding = formatTaskStreetQuery(row);

  /** @type {string[]} */
  const queries = [];
  if (street) {
    queries.push(street);
  }
  if (street && building) {
    queries.push(streetWithBuilding);
  } else if (!street && building) {
    queries.push(building);
  }
  if (venue && streetWithBuilding) {
    queries.push(`${venue}, ${streetWithBuilding}`);
  } else if (venue && street) {
    queries.push(`${venue}, ${street}`);
  }
  if (venue) {
    queries.push(venue);
  }
  return [...new Set(queries)];
}

/**
 * Primary geocode query (first candidate). Kept for tests and callers that
 * need a single display-aligned string.
 *
 * @param {{
 *   destination_address_name?: string | null,
 *   destination_address?: string | null,
 *   destination_building?: string | null,
 * }} row
 * @returns {string}
 */
export function formatTaskGeocodeQuery(row) {
  const queries = formatTaskGeocodeQueries(row);
  return queries[0] ?? "";
}

/**
 * @param {{
 *   addressName?: string | null,
 *   streetLine?: string | null,
 *   building?: string | null,
 * }} row
 * @returns {string[]}
 */
export function formatAddressGeocodeQueries(row) {
  return formatTaskGeocodeQueries({
    destination_address_name: row.addressName,
    destination_address: row.streetLine,
    destination_building: row.building,
  });
}

/**
 * @returns {string | null}
 */
export function getGoogleMapsApiKey() {
  const key = trim(process.env.GOOGLE_MAPS_API_KEY);
  return key || null;
}

/**
 * @param {string} query
 * @returns {Promise<{ lat: number, lng: number }>}
 */
export async function geocodeAddress(query) {
  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) {
    throw Object.assign(
      new Error("Route optimization is not configured (GOOGLE_MAPS_API_KEY)"),
      { status: 503 },
    );
  }

  const address = trim(query);
  if (!address) {
    throw Object.assign(new Error("Address is required for geocoding"), {
      status: 400,
    });
  }

  const url = new URL(GEOCODE_URL);
  url.searchParams.set("address", address);
  url.searchParams.set("key", apiKey);

  const res = await fetch(url);
  if (!res.ok) {
    throw Object.assign(new Error(`Geocoding request failed (${res.status})`), {
      status: 502,
    });
  }

  const data = await res.json();
  if (data.status !== "OK" || !Array.isArray(data.results) || !data.results[0]) {
    const detail = trim(data.error_message);
    const geocodeStatus = trim(data.status);
    const message =
      data.status === "REQUEST_DENIED" && detail
        ? `Geocoding API: ${detail}`
        : detail ||
          (geocodeStatus
            ? `Address could not be geocoded (${geocodeStatus})`
            : "Address could not be geocoded");
    throw Object.assign(new Error(message), {
      status: data.status === "REQUEST_DENIED" ? 503 : 422,
    });
  }

  const location = data.results[0].geometry?.location;
  const lat = Number(location?.lat);
  const lng = Number(location?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw Object.assign(new Error("Geocoding returned invalid coordinates"), {
      status: 502,
    });
  }

  return { lat, lng };
}

/**
 * @param {number | string | null | undefined} value
 * @returns {number | null}
 */
function asCoord(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {{
 *   destination_latitude?: number | string | null,
 *   destination_longitude?: number | string | null,
 *   address_latitude?: number | string | null,
 *   address_longitude?: number | string | null,
 * }} taskRow
 * @returns {{ lat: number, lng: number } | null}
 */
export function resolveTaskCoordinates(taskRow) {
  const taskLat = asCoord(taskRow.destination_latitude);
  const taskLng = asCoord(taskRow.destination_longitude);
  if (taskLat != null && taskLng != null) {
    return { lat: taskLat, lng: taskLng };
  }

  const addressLat = asCoord(taskRow.address_latitude);
  const addressLng = asCoord(taskRow.address_longitude);
  if (addressLat != null && addressLng != null) {
    return { lat: addressLat, lng: addressLng };
  }

  return null;
}

/**
 * @template T
 * @param {T[]} items
 * @param {number} limit
 * @param {(item: T) => Promise<unknown>} worker
 */
export async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index]);
    }
  }

  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    () => runWorker(),
  );
  await Promise.all(workers);
  return results;
}
