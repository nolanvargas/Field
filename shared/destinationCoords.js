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
 *   latitude?: number | string | null,
 *   longitude?: number | string | null,
 *   destinationLatitude?: number | string | null,
 *   destinationLongitude?: number | string | null,
 * }} row
 */
export function hasDestinationCoords(row) {
  const lat = asCoord(row.destinationLatitude ?? row.latitude);
  const lng = asCoord(row.destinationLongitude ?? row.longitude);
  return lat != null && lng != null;
}
