import {
  formatAddressGeocodeQueries,
  getGoogleMapsApiKey,
} from "./geocoding.mjs";

const PLACES_BASE = "https://places.googleapis.com/v1";

/**
 * @param {string | null | undefined} value
 */
function trim(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * @param {unknown} placeId
 */
function normalizePlaceId(placeId) {
  const raw = trim(placeId);
  if (!raw) return "";
  return raw.startsWith("places/") ? raw.slice("places/".length) : raw;
}

/**
 * @param {string} placeId
 */
function placeResourceName(placeId) {
  const id = normalizePlaceId(placeId);
  return `places/${id}`;
}

/**
 * @param {Response} res
 */
async function readPlacesError(res) {
  const detail = await res.text().catch(() => "");
  return detail ? detail.slice(0, 300) : "";
}

/**
 * @param {string} input
 * @param {string | undefined} sessionToken
 */
export async function autocompletePlaces(input, sessionToken) {
  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) {
    throw Object.assign(
      new Error("Places API is not configured (GOOGLE_MAPS_API_KEY)"),
      { status: 503 },
    );
  }

  const query = trim(input);
  if (!query) {
    return { suggestions: [] };
  }

  /** @type {Record<string, unknown>} */
  const body = { input: query };
  if (sessionToken) {
    body.sessionToken = sessionToken;
  }

  const res = await fetch(`${PLACES_BASE}/places:autocomplete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await readPlacesError(res);
    throw Object.assign(
      new Error(
        `Places autocomplete failed (${res.status})${detail ? `: ${detail}` : ""}`,
      ),
      { status: 502 },
    );
  }

  const data = await res.json();
  const suggestions = Array.isArray(data?.suggestions) ? data.suggestions : [];

  return {
    suggestions: suggestions
      .map((item) => parseAutocompleteSuggestion(item))
      .filter((item) => item != null),
  };
}

/**
 * @param {unknown} item
 */
function parseAutocompleteSuggestion(item) {
  const prediction = item?.placePrediction;
  if (!prediction || typeof prediction !== "object") return null;

  const placeId = normalizePlaceId(
    prediction.placeId ?? prediction.place ?? "",
  );
  const label = trim(
    prediction.text?.text ??
      prediction.structuredFormat?.mainText?.text ??
      "",
  );
  if (!placeId || !label) return null;
  return { placeId, label };
}

/**
 * @param {string} placeId
 * @param {string | undefined} sessionToken
 */
export async function getPlaceDetails(placeId, sessionToken) {
  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) {
    throw Object.assign(
      new Error("Places API is not configured (GOOGLE_MAPS_API_KEY)"),
      { status: 503 },
    );
  }

  const id = normalizePlaceId(placeId);
  if (!id) {
    throw Object.assign(new Error("placeId is required"), { status: 400 });
  }

  const url = new URL(`${PLACES_BASE}/${placeResourceName(id)}`);
  if (sessionToken) {
    url.searchParams.set("sessionToken", sessionToken);
  }

  const res = await fetch(url, {
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "id,displayName,formattedAddress,location,addressComponents",
    },
  });

  if (!res.ok) {
    const detail = await readPlacesError(res);
    throw Object.assign(
      new Error(
        `Places details failed (${res.status})${detail ? `: ${detail}` : ""}`,
      ),
      { status: res.status === 404 ? 404 : 502 },
    );
  }

  const data = await res.json();
  return parsePlaceDetails(data);
}

/**
 * @param {unknown} data
 */
export function parsePlaceDetails(data) {
  const placeId = normalizePlaceId(data?.id ?? "");
  const latitude = Number(data?.location?.latitude);
  const longitude = Number(data?.location?.longitude);
  if (!placeId || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw Object.assign(new Error("Place details returned invalid coordinates"), {
      status: 502,
    });
  }

  const formattedAddress = trim(data?.formattedAddress);
  const displayName = trim(data?.displayName?.text);
  const formattedStreetLine =
    formattedAddress || formatStreetFromComponents(data?.addressComponents);

  return {
    placeId,
    latitude,
    longitude,
    formattedAddress,
    formattedStreetLine,
    displayName: displayName || null,
  };
}

/**
 * @param {unknown} components
 */
function formatStreetFromComponents(components) {
  if (!Array.isArray(components)) return "";

  /** @type {Record<string, string>} */
  const byType = {};
  for (const component of components) {
    const types = Array.isArray(component?.types) ? component.types : [];
    const text = trim(component?.longText ?? component?.shortText ?? "");
    if (!text) continue;
    for (const type of types) {
      if (!byType[type]) byType[type] = text;
    }
  }

  const streetNumber = byType.street_number ?? "";
  const route = byType.route ?? "";
  const street = [streetNumber, route].filter(Boolean).join(" ").trim();
  const locality = byType.locality ?? byType.postal_town ?? "";
  const admin = byType.administrative_area_level_1 ?? "";
  const postal = byType.postal_code ?? "";
  const cityLine = [locality, admin, postal].filter(Boolean).join(", ");
  if (street && cityLine) return `${street}, ${cityLine}`;
  return street || cityLine || "";
}

/**
 * @param {string} query
 */
export async function searchPlaceTopMatch(query) {
  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) {
    throw Object.assign(
      new Error("Places API is not configured (GOOGLE_MAPS_API_KEY)"),
      { status: 503 },
    );
  }

  const textQuery = trim(query);
  if (!textQuery) {
    throw Object.assign(new Error("query is required"), { status: 400 });
  }

  const res = await fetch(`${PLACES_BASE}/places:searchText`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id,places.formattedAddress,places.location",
    },
    body: JSON.stringify({ textQuery }),
  });

  if (!res.ok) {
    const detail = await readPlacesError(res);
    throw Object.assign(
      new Error(
        `Places text search failed (${res.status})${detail ? `: ${detail}` : ""}`,
      ),
      { status: 502 },
    );
  }

  const data = await res.json();
  const places = Array.isArray(data?.places) ? data.places : [];
  if (places.length === 0) {
    throw Object.assign(new Error("No matching place found"), { status: 422 });
  }

  return parsePlaceDetails(places[0]);
}

/**
 * Merge Places details with user-typed address fields.
 *
 * @param {{
 *   addressName?: string | null,
 *   streetLine?: string | null,
 *   building?: string | null,
 * }} typed
 * @param {ReturnType<typeof parsePlaceDetails>} place
 */
export function mergePlaceWithTypedAddress(typed, place) {
  const typedStreet = trim(typed.streetLine);
  const typedName = trim(typed.addressName);
  const typedBuilding = trim(typed.building);

  return {
    streetLine: place.formattedStreetLine || typedStreet,
    addressName: typedName || place.displayName || null,
    building: typedBuilding || null,
    latitude: place.latitude,
    longitude: place.longitude,
    googlePlaceId: place.placeId,
  };
}

/**
 * @param {{
 *   addressName?: string | null,
 *   streetLine?: string | null,
 *   building?: string | null,
 * }} row
 * @returns {string}
 */
export function formatAddressGeocodeQuery(row) {
  const queries = formatAddressGeocodeQueries(row);
  return queries[0] ?? "";
}
