/**
 * Build multistop driving directions URLs for native maps apps.
 * Stops must already be in visit order (e.g. after Google Routes optimization).
 *
 * @param {{ latitude: number, longitude: number }[]} stops
 * @param {'ios' | 'android' | 'web'} platform
 * @returns {string}
 */
export function buildMultistopMapsUrl(stops, platform) {
  if (!Array.isArray(stops) || stops.length === 0) {
    throw Object.assign(new Error("At least one stop is required"), {
      status: 400,
    });
  }

  const coords = stops.map((stop) => formatLatLng(stop.latitude, stop.longitude));

  if (platform === "ios") {
    return buildAppleMapsUrl(coords);
  }

  return buildGoogleMapsUrl(coords);
}

/**
 * @param {string[]} coords "lat,lng" strings in visit order
 */
function buildAppleMapsUrl(coords) {
  const params = new URLSearchParams();
  params.set("mode", "driving");
  const destination = coords[coords.length - 1];
  params.set("destination", destination);
  for (let i = 0; i < coords.length - 1; i += 1) {
    params.append("waypoint", coords[i]);
  }
  return `https://maps.apple.com/directions?${params.toString()}`;
}

/**
 * @param {string[]} coords "lat,lng" strings in visit order
 */
function buildGoogleMapsUrl(coords) {
  const params = new URLSearchParams();
  params.set("api", "1");
  params.set("travelmode", "driving");
  params.set("destination", coords[coords.length - 1]);
  if (coords.length > 1) {
    params.set("waypoints", coords.slice(0, -1).join("|"));
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/**
 * @param {number} latitude
 * @param {number} longitude
 */
function formatLatLng(latitude, longitude) {
  return `${latitude},${longitude}`;
}

/**
 * Reorder stops using Google Routes optimizedIntermediateWaypointIndex.
 *
 * @param {T[]} stops
 * @param {number[]} optimizedIndexes indexes into stops (intermediates only)
 * @param {{ latitude: number, longitude: number }} origin
 * @param {{ latitude: number, longitude: number }} destination
 * @returns {T[]}
 * @template T
 */
export function reorderStopsByOptimizedIndexes(
  stops,
  optimizedIndexes,
  origin,
  destination,
) {
  if (stops.length === 0) return [];
  if (stops.length === 1) return [...stops];

  const originKey = coordKey(origin);
  const destKey = coordKey(destination);
  const sameOriginDest = originKey === destKey;

  if (sameOriginDest) {
    if (
      !Array.isArray(optimizedIndexes) ||
      optimizedIndexes.length !== stops.length
    ) {
      return [...stops];
    }
    return optimizedIndexes.map((index) => stops[index]);
  }

  const intermediateCount = stops.length - 2;
  if (
    intermediateCount <= 0 ||
    !Array.isArray(optimizedIndexes) ||
    optimizedIndexes.length !== intermediateCount
  ) {
    return [...stops];
  }

  const first = stops[0];
  const last = stops[stops.length - 1];
  const middle = stops.slice(1, -1);
  const reorderedMiddle = optimizedIndexes.map((index) => middle[index]);
  return [first, ...reorderedMiddle, last];
}

/**
 * @param {{ latitude: number, longitude: number }} point
 */
function coordKey(point) {
  return `${point.latitude},${point.longitude}`;
}
