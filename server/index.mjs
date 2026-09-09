import "./loadEnv.mjs";
import { createServer } from "node:http";
import {
  confirmAttachment,
  createPresign,
  deleteAttachment,
  getAttachmentDownloadUrl,
  listAttachments,
} from "./attachments.mjs";
import {
  isWebAuthEnabled,
  getWebAuthPublicConfig,
  assertOrgConfiguration,
  assertTaskActorForMutation,
  requireWebAuth,
  resolveAuthenticatedUserId,
  resolveTaskActor,
  resolveScopedTaskListFilters,
  upsertUserFromVerifiedIdentity,
  verifyWebToken,
  getBearerToken,
  PERMISSIONS,
} from "./auth.mjs";
import { assertPermission } from "./permissions.mjs";
import { assertUserCanViewTask } from "./taskAccess.mjs";
import { getPool } from "./db.mjs";
import { cloneTask } from "./cloneTask.mjs";
import { createCrewEvent, createTask, updateTask, updateTaskStatus, listCompletionNotes, endOpenCrewStarts } from "./createTask.mjs";
import { getTaskHistory, recordTaskHistoryEvent } from "./taskHistory.mjs";
import {
  activateMobileDevice,
  issueActivationCode,
  listMobileDevices,
  revokeAllMobileDevices,
  revokeMobileDevice,
} from "./mobileAuth.mjs";
import { listDocumentTypes } from "../shared/documentTypes.js";
import {
  getOrgPrintTemplatesPayload,
  isPrintConfigured,
  listPrintTemplates,
  renderPrint,
} from "./print.mjs";
import {
  trackingPath,
  trackingUrl,
} from "./trackingToken.mjs";
import {
  getTrackingDocument,
  getTrackingPageByToken,
} from "./taskTracking.mjs";
import {
  purgeExpiredCancelledTasks,
  startCancelledTaskPurgeScheduler,
} from "./purgeCancelledTasks.mjs";
import { assertRestoreWindowOpenFromArchiveAt } from "../shared/cancelRetention.js";
import {
  getOrgSettings,
  lookupTaskByExternalQuery,
  updateOrgSettings,
} from "./orgSettings.mjs";
import {
  USER_SELECT,
  createUser,
  deactivateUser,
  mapUserRow,
  updateUser,
} from "./users.mjs";
import {
  normalizeStoredCustomFields,
  parseCustomFieldDefsSnapshot,
  resolveCustomFieldDisplays,
  resolveCustomFieldDisplaysForMany,
} from "./customFields.mjs";
import {
  parseEntityCustomFields,
  withEntityCustomFields,
  withEntityCustomFieldsForMany,
} from "./entityCustomFields.mjs";
import { CUSTOM_FIELD_ENTITIES } from "../shared/customFieldEntities.js";
import {
  isValidAttachmentKeyForTask,
  putLocalObject,
  readLocalObjectResponse,
  readRawBody,
  storageKeyFromLocalPath,
} from "./storage.mjs";
import {
  applyImport,
  getImportTemplate,
  isImportEntity,
  parseImportMode,
  previewImport,
} from "./bulkImport/index.mjs";
import { readMultipartCsv } from "./bulkImport/multipart.mjs";
import { formatAddressGeocodeQueries } from "./geocoding.mjs";
import {
  persistAddressCoordinates,
  persistTaskDestinationCoordinates,
} from "./geocodeAddresses.mjs";
import {
  autocompletePlaces,
  getPlaceDetails,
  searchPlaceTopMatch,
} from "./places.mjs";

const PORT = Number(process.env.API_PORT) || 3000;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

/**
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @param {unknown} body
 * @param {number} [status]
 */
function sendJson(res, body, status = 200) {
  const buf = Buffer.from(JSON.stringify(body), "utf8");
  // Content-Length avoids Transfer-Encoding: chunked. Chunked responses through
  // the Vite proxy are flaky on Capacitor/WebView (net::ERR_INVALID_CHUNKED_ENCODING).
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": buf.length,
    ...CORS_HEADERS,
  });
  res.end(buf);
}

/**
 * @param {import('node:http').ServerResponse} res
 */
function sendNoContent(res) {
  res.writeHead(204, {
    ...CORS_HEADERS,
  });
  res.end();
}

/**
 * @param {import('node:http').ServerResponse} res
 * @param {string} csv
 * @param {string} fileName
 */
function sendCsv(res, csv, fileName) {
  const buf = Buffer.from(csv, "utf8");
  const safeName = String(fileName).replace(/[^\w.\- ()+]+/g, "_");
  res.writeHead(200, {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Length": buf.length,
    "Content-Disposition": `attachment; filename="${safeName}"`,
    ...CORS_HEADERS,
  });
  res.end(buf);
}

/**
 * @param {import('node:http').ServerResponse} res
 * @param {Buffer} buf
 * @param {string} fileName
 * @param {'inline' | 'attachment'} [disposition]
 */
function sendPdf(res, buf, fileName, disposition = "inline") {
  const safeName = String(fileName).replace(/[^\w.\- ()+]+/g, "_");
  /** @type {Record<string, string | number>} */
  const headers = {
    "Content-Type": "application/pdf",
    "Content-Length": buf.length,
    ...CORS_HEADERS,
  };
  // Prefer bare `inline` so browsers open the viewer; only attach a filename when downloading.
  if (disposition === "attachment") {
    headers["Content-Disposition"] = `attachment; filename="${safeName}"`;
  } else {
    headers["Content-Disposition"] = "inline";
  }
  res.writeHead(200, headers);
  res.end(buf);
}

/**
 * @param {import('node:http').IncomingMessage} req
 */
async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw Object.assign(new Error("Invalid JSON body"), { status: 400 });
  }
}

/**
 * @param {string} url
 */
function parseUrl(url) {
  return new URL(url, `http://localhost:${PORT}`);
}

/**
 * Resolve acting user for permission-gated routes.
 * Entra or device session when auth is on; dev (no Entra): body/query actor id.
 * @param {import('node:http').IncomingMessage} request
 * @param {Record<string, unknown>} body
 * @param {string} [queryActorId]
 */
/**
 * @param {import('node:http').IncomingMessage} request
 * @param {number} taskId
 */
async function assertTaskViewAccess(request, taskId) {
  const actorUserId = await resolveAuthenticatedUserId(request);
  if (!actorUserId) return;
  await assertUserCanViewTask(actorUserId, taskId);
}

async function resolveActorUserId(request, body, queryActorId) {
  const fromAuth = await resolveAuthenticatedUserId(request);
  if (fromAuth) return fromAuth;
  if (typeof body.actorUserId === "string" && body.actorUserId.trim()) {
    return body.actorUserId.trim();
  }
  if (typeof body.createdByUserId === "string" && body.createdByUserId.trim()) {
    return body.createdByUserId.trim();
  }
  if (typeof body.revokedByUserId === "string" && body.revokedByUserId.trim()) {
    return body.revokedByUserId.trim();
  }
  if (typeof queryActorId === "string" && queryActorId.trim()) {
    return queryActorId.trim();
  }
  return "";
}

/**
 * @param {import('pg').QueryResultRow} row
 */
function mapContactRow(row) {
  return {
    id: Number(row.id),
    name: row.name,
    title: row.title ?? "",
    phone: row.phone ?? "",
    email: row.email ?? "",
  };
}

const CONTACT_SELECT = `
  SELECT
    c.id,
    c.name,
    COALESCE(c.title, '') AS title,
    c.phone,
    COALESCE(c.email, '') AS email,
    c.custom_fields
  FROM contacts c
  WHERE c.deleted_at IS NULL
`;

/**
 * @param {import('pg').QueryResultRow[]} rows
 * @param {string} entity
 */
function withCustomFieldsForRows(rows, entity, map) {
  return withEntityCustomFieldsForMany(
    getPool(),
    entity,
    rows.map(map),
    rows.map((row) => row.custom_fields),
  );
}

async function listContacts() {
  const pool = getPool();
  const { rows } = await pool.query(
    `${CONTACT_SELECT}
     ORDER BY c.name`,
  );
  return withCustomFieldsForRows(
    rows,
    CUSTOM_FIELD_ENTITIES.contact,
    mapContactRow,
  );
}

/**
 * @param {string} q
 */
async function searchContacts(q) {
  const pool = getPool();
  const { rows } = await pool.query(
    `${CONTACT_SELECT}
       AND (
         c.name ILIKE '%' || $1 || '%'
         OR COALESCE(c.title, '') ILIKE '%' || $1 || '%'
         OR COALESCE(c.email, '') ILIKE '%' || $1 || '%'
         OR COALESCE(c.phone, '') ILIKE '%' || $1 || '%'
       )
     ORDER BY
       CASE WHEN lower(c.name) LIKE lower($1) || '%' THEN 0 ELSE 1 END,
       c.name
     LIMIT 20`,
    [q],
  );
  return withCustomFieldsForRows(
    rows,
    CUSTOM_FIELD_ENTITIES.contact,
    mapContactRow,
  );
}

/**
 * @param {number} id
 */
async function getContact(id) {
  const pool = getPool();
  const { rows } = await pool.query(`${CONTACT_SELECT} AND c.id = $1`, [id]);
  if (!rows[0]) return null;
  return withEntityCustomFields(
    pool,
    CUSTOM_FIELD_ENTITIES.contact,
    mapContactRow(rows[0]),
    rows[0].custom_fields,
  );
}

/**
 * @param {import('pg').QueryResultRow} row
 */
function mapAddressRow(row) {
  return {
    id: Number(row.id),
    addressName: row.address_name ?? "",
    streetLine: row.street_line,
    building: row.building ?? "",
    notes: row.notes ?? "",
    latitude: row.latitude != null ? Number(row.latitude) : null,
    longitude: row.longitude != null ? Number(row.longitude) : null,
    googlePlaceId: row.google_place_id ?? null,
  };
}

const ADDRESS_SELECT =
  "id, address_name, street_line, building, notes, latitude, longitude, google_place_id, custom_fields";

async function listAddresses() {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT ${ADDRESS_SELECT}
     FROM addresses
     WHERE deleted_at IS NULL
     ORDER BY COALESCE(NULLIF(address_name, ''), street_line), id`,
  );
  return withCustomFieldsForRows(
    rows,
    CUSTOM_FIELD_ENTITIES.address,
    mapAddressRow,
  );
}

/**
 * @param {number} id
 */
async function getAddress(id) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT ${ADDRESS_SELECT}
     FROM addresses
     WHERE id = $1
       AND deleted_at IS NULL`,
    [id],
  );
  if (!rows[0]) return null;
  return withEntityCustomFields(
    pool,
    CUSTOM_FIELD_ENTITIES.address,
    mapAddressRow(rows[0]),
    rows[0].custom_fields,
  );
}

/**
 * @param {unknown} body
 */
function parseContactBody(body) {
  const name =
    body && typeof body === "object" && "name" in body
      ? String(body.name ?? "").trim()
      : "";
  if (!name) {
    throw Object.assign(new Error("name is required"), { status: 400 });
  }
  if (name.length > 255) {
    throw Object.assign(new Error("name must be 255 characters or fewer"), {
      status: 400,
    });
  }

  const title =
    body && typeof body === "object" && "title" in body
      ? String(body.title ?? "").trim() || null
      : null;
  if (title && title.length > 255) {
    throw Object.assign(new Error("title must be 255 characters or fewer"), {
      status: 400,
    });
  }

  const phone =
    body && typeof body === "object" && "phone" in body
      ? String(body.phone ?? "").trim() || null
      : null;
  if (phone && phone.length > 50) {
    throw Object.assign(new Error("phone must be 50 characters or fewer"), {
      status: 400,
    });
  }

  const email =
    body && typeof body === "object" && "email" in body
      ? String(body.email ?? "").trim() || null
      : null;
  if (email && email.length > 255) {
    throw Object.assign(new Error("email must be 255 characters or fewer"), {
      status: 400,
    });
  }

  return { name, title, phone, email };
}

/**
 * @param {unknown} body
 */
async function createContact(body) {
  const { name, title, phone, email } = parseContactBody(body);

  const pool = getPool();
  const customFields = await parseEntityCustomFields(
    pool,
    CUSTOM_FIELD_ENTITIES.contact,
    body,
    { requireAll: true },
  );
  const { rows } = await pool.query(
    `INSERT INTO contacts (name, title, phone, email, custom_fields)
     VALUES ($1, $2, $3, $4, $5::jsonb)
     RETURNING id, name, COALESCE(title, '') AS title, phone,
               COALESCE(email, '') AS email, custom_fields`,
    [name, title, phone, email, JSON.stringify(customFields ?? {})],
  );
  return withEntityCustomFields(
    pool,
    CUSTOM_FIELD_ENTITIES.contact,
    mapContactRow(rows[0]),
    rows[0].custom_fields,
  );
}

/**
 * @param {number} id
 * @param {unknown} body
 */
async function updateContact(id, body) {
  const { name, title, phone, email } = parseContactBody(body);

  const pool = getPool();
  const customFields = await parseEntityCustomFields(
    pool,
    CUSTOM_FIELD_ENTITIES.contact,
    body,
    { requireAll: true },
  );
  const { rows } = await pool.query(
    `UPDATE contacts
     SET name = $2,
         title = $3,
         phone = $4,
         email = $5,
         custom_fields = $6::jsonb,
         updated_at = now()
     WHERE id = $1
       AND deleted_at IS NULL
     RETURNING id, name, COALESCE(title, '') AS title, phone,
               COALESCE(email, '') AS email, custom_fields`,
    [id, name, title, phone, email, JSON.stringify(customFields ?? {})],
  );
  if (rows.length === 0) {
    throw Object.assign(new Error("Contact not found"), { status: 404 });
  }
  return withEntityCustomFields(
    pool,
    CUSTOM_FIELD_ENTITIES.contact,
    mapContactRow(rows[0]),
    rows[0].custom_fields,
  );
}

/**
 * @param {number} id
 */
async function deleteContact(id) {
  const pool = getPool();
  const { rowCount } = await pool.query(
    `UPDATE contacts
     SET deleted_at = now(),
         updated_at = now()
     WHERE id = $1
       AND deleted_at IS NULL`,
    [id],
  );
  if (rowCount === 0) {
    throw Object.assign(new Error("Contact not found"), { status: 404 });
  }
}

/**
 * @param {unknown} value
 * @returns {number | null}
 */
function parseOptionalCoord(value, fieldName) {
  if (value === undefined) return undefined;
  if (value === "" || value == null) return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) {
    throw Object.assign(new Error(`${fieldName} must be a number`), {
      status: 400,
    });
  }
  return n;
}

/**
 * @param {unknown} body
 */
function parseAddressBody(body) {
  const addressName =
    body && typeof body === "object" && "addressName" in body
      ? String(body.addressName ?? "").trim() || null
      : null;
  if (addressName && addressName.length > 255) {
    throw Object.assign(
      new Error("addressName must be 255 characters or fewer"),
      { status: 400 },
    );
  }

  const streetLine =
    body && typeof body === "object" && "streetLine" in body
      ? String(body.streetLine ?? "").trim()
      : "";
  if (!streetLine) {
    throw Object.assign(new Error("streetLine is required"), { status: 400 });
  }
  if (streetLine.length > 500) {
    throw Object.assign(
      new Error("streetLine must be 500 characters or fewer"),
      { status: 400 },
    );
  }

  const building =
    body && typeof body === "object" && "building" in body
      ? String(body.building ?? "").trim() || null
      : null;
  if (building && building.length > 255) {
    throw Object.assign(new Error("building must be 255 characters or fewer"), {
      status: 400,
    });
  }

  const notes =
    body && typeof body === "object" && "notes" in body
      ? String(body.notes ?? "").trim() || null
      : null;

  const latitude =
    body && typeof body === "object" && "latitude" in body
      ? parseOptionalCoord(body.latitude, "latitude")
      : undefined;
  const longitude =
    body && typeof body === "object" && "longitude" in body
      ? parseOptionalCoord(body.longitude, "longitude")
      : undefined;
  const googlePlaceId =
    body && typeof body === "object" && "googlePlaceId" in body
      ? String(body.googlePlaceId ?? "").trim() || null
      : undefined;

  const hasLat = latitude !== undefined;
  const hasLng = longitude !== undefined;
  if (hasLat !== hasLng) {
    throw Object.assign(
      new Error("latitude and longitude must be provided together"),
      { status: 400 },
    );
  }
  if (hasLat && (latitude != null) !== (longitude != null)) {
    throw Object.assign(
      new Error("latitude and longitude must both be set or both be null"),
      { status: 400 },
    );
  }

  return {
    addressName,
    streetLine,
    building,
    notes,
    latitude,
    longitude,
    googlePlaceId,
  };
}

/**
 * @param {unknown} body
 */
async function createAddress(body) {
  const {
    addressName,
    streetLine,
    building,
    notes,
    latitude,
    longitude,
    googlePlaceId,
  } = parseAddressBody(body);

  const pool = getPool();
  const customFields = await parseEntityCustomFields(
    pool,
    CUSTOM_FIELD_ENTITIES.address,
    body,
    { requireAll: true },
  );
  const { rows } = await pool.query(
    `INSERT INTO addresses (
       address_name,
       street_line,
       building,
       notes,
       latitude,
       longitude,
       google_place_id,
       custom_fields
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
     RETURNING ${ADDRESS_SELECT}`,
    [
      addressName,
      streetLine,
      building,
      notes,
      latitude ?? null,
      longitude ?? null,
      googlePlaceId ?? null,
      JSON.stringify(customFields ?? {}),
    ],
  );
  return withEntityCustomFields(
    pool,
    CUSTOM_FIELD_ENTITIES.address,
    mapAddressRow(rows[0]),
    rows[0].custom_fields,
  );
}

/**
 * @param {number} id
 * @param {unknown} body
 */
async function updateAddress(id, body) {
  const {
    addressName,
    streetLine,
    building,
    notes,
    latitude,
    longitude,
    googlePlaceId,
  } = parseAddressBody(body);

  const pool = getPool();
  const customFields = await parseEntityCustomFields(
    pool,
    CUSTOM_FIELD_ENTITIES.address,
    body,
    { requireAll: true },
  );
  const existing = await getAddress(id);
  if (!existing) {
    throw Object.assign(new Error("Address not found"), { status: 404 });
  }

  const nameChanged = (addressName ?? "") !== (existing.addressName ?? "");
  const streetChanged = streetLine !== existing.streetLine;
  const hasNewPlace =
    googlePlaceId !== undefined && googlePlaceId != null && googlePlaceId !== "";

  /** @type {number | null | undefined} */
  let nextLatitude = latitude;
  /** @type {number | null | undefined} */
  let nextLongitude = longitude;
  /** @type {string | null | undefined} */
  let nextGooglePlaceId = googlePlaceId;

  if ((nameChanged || streetChanged) && !hasNewPlace) {
    nextLatitude = null;
    nextLongitude = null;
    nextGooglePlaceId = null;
  } else if (latitude === undefined) {
    nextLatitude = existing.latitude;
    nextLongitude = existing.longitude;
    nextGooglePlaceId =
      googlePlaceId === undefined ? existing.googlePlaceId : googlePlaceId;
  }

  const { rows } = await pool.query(
    `UPDATE addresses
     SET address_name = $2,
         street_line = $3,
         building = $4,
         notes = $5,
         latitude = $6,
         longitude = $7,
         google_place_id = $8,
         custom_fields = $9::jsonb
     WHERE id = $1
       AND deleted_at IS NULL
     RETURNING ${ADDRESS_SELECT}`,
    [
      id,
      addressName,
      streetLine,
      building,
      notes,
      nextLatitude ?? null,
      nextLongitude ?? null,
      nextGooglePlaceId ?? null,
      JSON.stringify(customFields ?? {}),
    ],
  );
  if (rows.length === 0) {
    throw Object.assign(new Error("Address not found"), { status: 404 });
  }
  return withEntityCustomFields(
    pool,
    CUSTOM_FIELD_ENTITIES.address,
    mapAddressRow(rows[0]),
    rows[0].custom_fields,
  );
}

/**
 * @param {number} id
 * @param {unknown} body
 */
async function patchAddressCoordinates(id, body) {
  const latitude = parseOptionalCoord(
    body && typeof body === "object" ? body.latitude : null,
    "latitude",
  );
  const longitude = parseOptionalCoord(
    body && typeof body === "object" ? body.longitude : null,
    "longitude",
  );
  if (latitude == null || longitude == null) {
    throw Object.assign(
      new Error("latitude and longitude are required"),
      { status: 400 },
    );
  }

  const pool = getPool();
  await persistAddressCoordinates(pool, id, latitude, longitude, null);
  const address = await getAddress(id);
  if (!address) {
    throw Object.assign(new Error("Address not found"), { status: 404 });
  }
  return address;
}

/**
 * @param {number} taskId
 * @param {unknown} body
 */
async function patchTaskDestinationCoordinates(taskId, body) {
  const latitude = parseOptionalCoord(
    body && typeof body === "object" ? body.latitude : null,
    "latitude",
  );
  const longitude = parseOptionalCoord(
    body && typeof body === "object" ? body.longitude : null,
    "longitude",
  );
  if (latitude == null || longitude == null) {
    throw Object.assign(
      new Error("latitude and longitude are required"),
      { status: 400 },
    );
  }

  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT destination_address_id
     FROM tasks
     WHERE id = $1
       AND deleted_at IS NULL`,
    [taskId],
  );
  if (rows.length === 0) {
    throw Object.assign(new Error("Task not found"), { status: 404 });
  }

  const addressId =
    rows[0].destination_address_id != null
      ? Number(rows[0].destination_address_id)
      : null;

  await persistTaskDestinationCoordinates(
    pool,
    taskId,
    latitude,
    longitude,
    addressId,
  );

  const task = await getTask(taskId);
  if (!task) {
    throw Object.assign(new Error("Task not found"), { status: 404 });
  }
  return task;
}

/**
 * @param {unknown} body
 */
async function fetchViewportHint(body) {
  const addressName =
    body && typeof body === "object" && "addressName" in body
      ? String(body.addressName ?? "").trim()
      : "";
  const streetLine =
    body && typeof body === "object" && "streetLine" in body
      ? String(body.streetLine ?? "").trim()
      : "";
  const building =
    body && typeof body === "object" && "building" in body
      ? String(body.building ?? "").trim()
      : "";

  const queries = formatAddressGeocodeQueries({
    addressName,
    streetLine,
    building,
  });
  if (queries.length === 0) {
    return {
      latitude: null,
      longitude: null,
      googlePlaceId: null,
      formattedAddress: null,
      formattedStreetLine: null,
      displayName: null,
    };
  }

  for (const query of queries) {
    try {
      const place = await searchPlaceTopMatch(query);
      return {
        latitude: place.latitude,
        longitude: place.longitude,
        googlePlaceId: place.placeId,
        formattedAddress: place.formattedAddress,
        formattedStreetLine: place.formattedStreetLine,
        displayName: place.displayName,
      };
    } catch (err) {
      if (err && typeof err === "object" && err.status === 503) {
        throw err;
      }
    }
  }

  return {
    latitude: null,
    longitude: null,
    googlePlaceId: null,
    formattedAddress: null,
    formattedStreetLine: null,
    displayName: null,
  };
}

/**
 * @param {number} id
 */
async function deleteAddress(id) {
  const pool = getPool();
  const { rowCount } = await pool.query(
    `UPDATE addresses
     SET deleted_at = now()
     WHERE id = $1
       AND deleted_at IS NULL`,
    [id],
  );
  if (rowCount === 0) {
    throw Object.assign(new Error("Address not found"), { status: 404 });
  }
}

/**
 * Cancel a task (status → Cancelled). Archived after org cancel_retention_days.
 * Boots any crew who have started but not ended.
 * @param {number} id
 */
async function cancelTask(id) {
  const org = await getOrgSettings();
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existing = await client.query(
      `SELECT id, status
       FROM tasks
       WHERE id = $1
         AND deleted_at IS NULL
       FOR UPDATE`,
      [id],
    );
    if (existing.rowCount === 0) {
      throw Object.assign(new Error("Task not found"), { status: 404 });
    }
    if (existing.rows[0].status === "Cancelled") {
      throw Object.assign(new Error("Task is already cancelled"), {
        status: 409,
      });
    }

    await endOpenCrewStarts(client, id);

    const fromStatus = existing.rows[0].status;
    const retentionDays = org.cancelRetentionDays;
    const archiveClause =
      retentionDays != null
        ? `archive_at = now() + ($2::int * interval '1 day')`
        : `archive_at = NULL`;
    const cancelParams =
      retentionDays != null ? [id, retentionDays] : [id];

    const { rowCount } = await client.query(
      `UPDATE tasks
       SET status_before_cancel = status,
           status = 'Cancelled'::task_status,
           cancelled_at = now(),
           ${archiveClause},
           updated_at = now()
       WHERE id = $1
         AND deleted_at IS NULL
         AND status <> 'Cancelled'::task_status`,
      cancelParams,
    );
    if (rowCount === 0) {
      throw Object.assign(new Error("Task not found"), { status: 404 });
    }

    await recordTaskHistoryEvent(client, {
      taskId: id,
      eventType: "status_changed",
      fromStatus,
      toStatus: "Cancelled",
      summary: "Task cancelled",
    });

    await client.query("COMMIT");
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore rollback errors
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Restore a cancelled task as Undetermined (within the org retention window).
 * @param {number} id
 */
async function restoreTask(id) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existing = await client.query(
      `SELECT id, status, archive_at
       FROM tasks
       WHERE id = $1
         AND deleted_at IS NULL
       FOR UPDATE`,
      [id],
    );
    if (existing.rowCount === 0) {
      throw Object.assign(new Error("Task not found"), { status: 404 });
    }
    if (existing.rows[0].status !== "Cancelled") {
      throw Object.assign(new Error("Task is not cancelled"), { status: 409 });
    }

    const archiveAt = existing.rows[0].archive_at
      ? new Date(existing.rows[0].archive_at).toISOString()
      : null;
    assertRestoreWindowOpenFromArchiveAt(archiveAt);

    const { rows } = await client.query(
      `UPDATE tasks
       SET status = 'Undetermined'::task_status,
           completed_at = COALESCE(completed_at, now()),
           cancelled_at = NULL,
           archive_at = NULL,
           status_before_cancel = NULL,
           updated_at = now()
       WHERE id = $1
       RETURNING id, status`,
      [id],
    );

    await recordTaskHistoryEvent(client, {
      taskId: id,
      eventType: "restored",
      fromStatus: "Cancelled",
      toStatus: "Undetermined",
      summary: "Task restored",
    });

    await client.query("COMMIT");

    return {
      id: Number(rows[0].id),
      status: rows[0].status,
    };
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore rollback errors
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * @param {string | null} role
 */
async function listUsers(role) {
  const pool = getPool();
  const params = [];
  let roleClause = "";
  if (role) {
    params.push(role);
    roleClause = `AND role = $${params.length}`;
  }

  const { rows } = await pool.query(
    `SELECT ${USER_SELECT}
     FROM users
     WHERE is_active = true
       ${roleClause}
     ORDER BY display_name`,
    params,
  );

  return withCustomFieldsForRows(rows, CUSTOM_FIELD_ENTITIES.user, mapUserRow);
}

/** Latest GPS ping per active user from task_crew_events. */
async function listCrewLocations() {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT DISTINCT ON (e.user_id)
       e.user_id,
       u.display_name,
       e.event_type,
       e.latitude,
       e.longitude,
       e.accuracy_meters,
       e.recorded_at,
       e.task_id,
       t.task_type,
       t.external_key,
       t.job_title,
       CASE
         WHEN t.destination_address_name IS NOT NULL
           AND t.destination_address_name <> ''
           THEN t.destination_address_name
         WHEN t.destination_building IS NOT NULL
           AND t.destination_building <> ''
           AND t.destination_address IS NOT NULL
           AND t.destination_address <> ''
           THEN t.destination_address || ', ' || t.destination_building
         ELSE COALESCE(t.destination_address, '')
       END AS destination_address
     FROM task_crew_events e
     JOIN users u ON u.id = e.user_id
     JOIN tasks t ON t.id = e.task_id
     WHERE e.latitude IS NOT NULL
       AND e.longitude IS NOT NULL
       AND u.is_active = true
     ORDER BY e.user_id, e.recorded_at DESC`,
  );

  return rows.map((row) => ({
    userId: String(row.user_id),
    displayName: row.display_name,
    eventType: row.event_type,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    accuracyMeters:
      row.accuracy_meters != null ? Number(row.accuracy_meters) : null,
    recordedAt: new Date(row.recorded_at).toISOString(),
    taskId: Number(row.task_id),
    taskType: row.task_type,
    externalKey: row.external_key ?? "",
    jobTitle: row.job_title ?? "",
    destinationAddress: row.destination_address ?? "",
  }));
}

/**
 * @param {{ crewMemberId?: string | null, createdByUserId?: string | null }} [opts]
 */
async function listTasks(opts = {}) {
  await purgeExpiredCancelledTasks();

  const pool = getPool();
  const crewMemberId =
    typeof opts.crewMemberId === "string" && opts.crewMemberId.trim()
      ? opts.crewMemberId.trim()
      : null;
  const createdByUserId =
    typeof opts.createdByUserId === "string" && opts.createdByUserId.trim()
      ? opts.createdByUserId.trim()
      : null;
  const params = [];
  let crewClause = "";
  if (crewMemberId || createdByUserId) {
    // Cancelled tasks stay on All Tasks / Delivery Cancelled only — not member lists.
    const parts = [];
    if (crewMemberId) {
      params.push(crewMemberId);
      parts.push(`EXISTS (
         SELECT 1
         FROM task_crew_members tcm_filter
         WHERE tcm_filter.task_id = t.id
           AND tcm_filter.user_id = $${params.length}
       )`);
    }
    if (createdByUserId) {
      params.push(createdByUserId);
      parts.push(`t.created_by_user_id = $${params.length}`);
    }
    crewClause = `AND t.status <> 'Cancelled'::task_status
       AND (${parts.join(" OR ")})`;
  }

  const { rows } = await pool.query(
    `SELECT
       t.id,
       t.task_type,
       t.status,
       t.external_key,
       t.job_title,
       t.description,
       t.window_start_at,
       t.window_end_at,
       t.cancelled_at,
       t.archive_at,
       t.tracking_token,
       t.custom_fields,
       t.custom_field_defs_snapshot,
       cu.display_name AS created_by_name,
       (
         SELECT string_agg(c.name, ', ' ORDER BY tc.is_poc DESC, c.name)
         FROM task_contacts tc
         JOIN contacts c ON c.id = tc.contact_id
         WHERE tc.task_id = t.id
       ) AS contact_names,
       COALESCE(t.destination_address_name, '') AS destination_address_name,
       COALESCE(t.destination_address, '') AS destination_street,
       COALESCE(t.destination_building, '') AS destination_building,
       CASE
         WHEN t.destination_address_name IS NOT NULL
           AND t.destination_address_name <> ''
           THEN t.destination_address_name
         WHEN t.destination_building IS NOT NULL
           AND t.destination_building <> ''
           AND t.destination_address IS NOT NULL
           AND t.destination_address <> ''
           THEN t.destination_address || ', ' || t.destination_building
         ELSE COALESCE(t.destination_address, '')
       END AS destination_address,
       (
         SELECT string_agg(u.display_name, ', ' ORDER BY tcm.is_lead DESC, u.display_name)
         FROM task_crew_members tcm
         JOIN users u ON u.id = tcm.user_id
         WHERE tcm.task_id = t.id
       ) AS crew_name
     FROM tasks t
     LEFT JOIN users cu ON cu.id = t.created_by_user_id
     WHERE t.deleted_at IS NULL
       ${crewClause}
     ORDER BY t.created_at DESC, t.id DESC`,
    params,
  );

  const customFieldItems = rows.map((row) => ({
    customFields: normalizeStoredCustomFields(row.custom_fields),
    customFieldDefs: parseCustomFieldDefsSnapshot(row.custom_field_defs_snapshot),
  }));
  const customFieldDisplaysList = await resolveCustomFieldDisplaysForMany(
    pool,
    customFieldItems,
  );

  return rows.map((row, index) => ({
    id: Number(row.id),
    taskType: row.task_type,
    status: row.status,
    externalKey: row.external_key ?? "",
    jobTitle: row.job_title ?? "",
    description: row.description ?? "",
    contactNames: row.contact_names ?? "",
    destinationAddressName: row.destination_address_name ?? "",
    destinationStreet: row.destination_street ?? "",
    destinationBuilding: row.destination_building ?? "",
    destinationAddress: row.destination_address ?? "",
    crewName: row.crew_name ?? null,
    createdByName: row.created_by_name ?? "",
    windowStartAt: row.window_start_at
      ? new Date(row.window_start_at).toISOString()
      : null,
    windowEndAt: row.window_end_at
      ? new Date(row.window_end_at).toISOString()
      : null,
    cancelledAt: row.cancelled_at
      ? new Date(row.cancelled_at).toISOString()
      : null,
    archiveAt: row.archive_at
      ? new Date(row.archive_at).toISOString()
      : null,
    trackingToken: row.tracking_token ? String(row.tracking_token) : "",
    trackingPath: row.tracking_token
      ? trackingPath(String(row.tracking_token))
      : "",
    trackingUrl: row.tracking_token
      ? trackingUrl(String(row.tracking_token))
      : "",
    customFields: customFieldItems[index].customFields,
    customFieldDefs: customFieldItems[index].customFieldDefs,
    customFieldDisplays: customFieldDisplaysList[index],
  }));
}

/**
 * @param {number} id
 */
async function getTask(id) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT
       t.id,
       t.task_type,
       t.task_type_id,
       t.status,
       t.description,
       t.job_title,
       t.external_key,
       t.custom_fields,
       t.custom_field_defs_snapshot,
       t.window_start_at,
       t.window_end_at,
       t.completed_notes,
       t.completed_at,
       t.failed_reason,
       t.cancelled_at,
       t.archive_at,
       t.created_at,
       t.updated_at,
       t.tracking_token,
       t.destination_address_id,
       t.destination_latitude,
       t.destination_longitude,
       COALESCE(t.destination_address_name, '') AS destination_address_name,
       COALESCE(t.destination_address, '') AS destination_address,
       COALESCE(t.destination_building, '') AS destination_building,
       COALESCE(t.destination_notes, '') AS destination_notes,
       cu.display_name AS created_by_name,
       cnu.display_name AS completion_notes_by_name,
       (
         SELECT coalesce(
           json_agg(
             json_build_object(
               'id', c.id,
               'name', c.name,
               'title', COALESCE(c.title, ''),
               'phone', COALESCE(c.phone, ''),
               'email', COALESCE(c.email, ''),
               'isPoc', tc.is_poc,
               'receivesEmail', tc.receives_email
             )
             ORDER BY tc.is_poc DESC, c.name
           ),
           '[]'::json
         )
         FROM task_contacts tc
         JOIN contacts c ON c.id = tc.contact_id
         WHERE tc.task_id = t.id
       ) AS contacts,
       (
         SELECT coalesce(
           json_agg(
             json_build_object(
               'id', u.id::text,
               'displayName', u.display_name,
               'isLead', tcm.is_lead,
               'startedAt', (
                 SELECT e.recorded_at
                 FROM task_crew_events e
                 WHERE e.task_id = t.id
                   AND e.user_id = u.id
                   AND e.event_type = 'started'
               ),
               'endedAt', (
                 SELECT e.recorded_at
                 FROM task_crew_events e
                 WHERE e.task_id = t.id
                   AND e.user_id = u.id
                   AND e.event_type = 'ended'
               )
             )
             ORDER BY tcm.is_lead DESC, u.display_name
           ),
           '[]'::json
         )
         FROM task_crew_members tcm
         JOIN users u ON u.id = tcm.user_id
         WHERE tcm.task_id = t.id
       ) AS crew_members
     FROM tasks t
     LEFT JOIN users cu ON cu.id = t.created_by_user_id
     LEFT JOIN users cnu ON cnu.id = t.completion_notes_by_user_id
     WHERE t.id = $1
       AND t.deleted_at IS NULL`,
    [id],
  );

  if (rows.length === 0) return null;

  const row = rows[0];
  const completionNotes = await listCompletionNotes(pool, id);
  const customFields = normalizeStoredCustomFields(row.custom_fields);
  const customFieldDefs = parseCustomFieldDefsSnapshot(
    row.custom_field_defs_snapshot,
  );
  const customFieldDisplays = await resolveCustomFieldDisplays(
    pool,
    customFields,
    customFieldDefs,
  );
  return {
    id: Number(row.id),
    taskType: row.task_type,
    taskTypeId:
      row.task_type_id != null ? Number(row.task_type_id) : null,
    status: row.status,
    description: row.description ?? "",
    jobTitle: row.job_title ?? "",
    externalKey: row.external_key ?? "",
    destinationAddressId:
      row.destination_address_id != null
        ? Number(row.destination_address_id)
        : null,
    destinationLatitude:
      row.destination_latitude != null ? Number(row.destination_latitude) : null,
    destinationLongitude:
      row.destination_longitude != null
        ? Number(row.destination_longitude)
        : null,
    destinationAddressName: row.destination_address_name,
    destinationAddress: row.destination_address,
    destinationBuilding: row.destination_building,
    destinationNotes: row.destination_notes,
    contacts: Array.isArray(row.contacts)
      ? row.contacts.map((c) => ({
          id: Number(c.id),
          name: c.name ?? "",
          title: c.title ?? "",
          phone: c.phone ?? "",
          email: c.email ?? "",
          isPoc: Boolean(c.isPoc),
          receivesEmail: Boolean(c.receivesEmail),
        }))
      : [],
    customFields,
    customFieldDefs,
    customFieldDisplays,
    windowStartAt: row.window_start_at
      ? new Date(row.window_start_at).toISOString()
      : null,
    windowEndAt: row.window_end_at
      ? new Date(row.window_end_at).toISOString()
      : null,
    completedNotes: row.completed_notes ?? null,
    completedAt: row.completed_at
      ? new Date(row.completed_at).toISOString()
      : null,
    failedReason: row.failed_reason ?? null,
    cancelledAt: row.cancelled_at
      ? new Date(row.cancelled_at).toISOString()
      : null,
    archiveAt: row.archive_at
      ? new Date(row.archive_at).toISOString()
      : null,
    completionNotes,
    completionNotesByName:
      completionNotes.length > 0
        ? completionNotes.map((n) => n.displayName).join(", ")
        : row.completion_notes_by_name ?? null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    createdByName: row.created_by_name ?? "",
    trackingToken: row.tracking_token ? String(row.tracking_token) : "",
    trackingPath: row.tracking_token
      ? trackingPath(String(row.tracking_token))
      : "",
    trackingUrl: row.tracking_token
      ? trackingUrl(String(row.tracking_token))
      : "",
    crewMembers: Array.isArray(row.crew_members)
      ? row.crew_members.map((m) => ({
          id: String(m.id),
          displayName: m.displayName ?? "",
          isLead: Boolean(m.isLead),
          startedAt: m.startedAt
            ? new Date(m.startedAt).toISOString()
            : null,
          endedAt: m.endedAt ? new Date(m.endedAt).toISOString() : null,
        }))
      : [],
  };
}

/**
 * Resolve a task id from an external key (exact or displayed job number) or
 * numeric internal id.
 * @param {string} query
 * @returns {Promise<number | null>}
 */
async function lookupTaskByQuery(query) {
  const q = String(query ?? "").trim();
  if (!q) return null;

  const taskId = await lookupTaskByExternalQuery(q);
  if (taskId != null) return taskId;

  if (/^\d+$/.test(q)) {
    const task = await getTask(Number(q));
    if (task) return task.id;
  }

  return null;
}

const server = createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    sendJson(res, {});
    return;
  }

  try {
    const url = parseUrl(req.url ?? "/");

    await requireWebAuth(req, url.pathname);

    const trackingPageMatch = url.pathname.match(
      /^\/api\/public\/tasks\/([^/]+)$/,
    );
    if (req.method === "GET" && trackingPageMatch) {
      const payload = await getTrackingPageByToken(
        decodeURIComponent(trackingPageMatch[1]),
      );
      sendJson(res, payload);
      return;
    }

    const trackingDocMatch = url.pathname.match(
      /^\/api\/public\/tasks\/([^/]+)\/documents\/([^/]+)$/,
    );
    if (req.method === "GET" && trackingDocMatch) {
      const { buffer, fileName } = await getTrackingDocument(
        decodeURIComponent(trackingDocMatch[1]),
        decodeURIComponent(trackingDocMatch[2]),
        getTask,
      );
      const disposition =
        url.searchParams.get("download") === "1" ? "attachment" : "inline";
      sendPdf(res, buffer, fileName, disposition);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/auth/config") {
      const [auth, org] = await Promise.all([
        getWebAuthPublicConfig(),
        getOrgSettings(),
      ]);
      sendJson(res, { ...auth, accentColor: org.accentColor });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/auth/session") {
      if (!(await isWebAuthEnabled())) {
        sendJson(res, { error: "Web auth is not configured" }, 503);
        return;
      }
      const token = getBearerToken(req);
      if (!token) {
        sendJson(res, { error: "Unauthorized" }, 401);
        return;
      }
      const identity = await verifyWebToken(token);
      const user = await upsertUserFromVerifiedIdentity(identity);
      sendJson(res, { user });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/contacts") {
      const q = (url.searchParams.get("q") ?? "").trim();
      const contacts =
        q.length < 1 ? await listContacts() : await searchContacts(q);
      sendJson(res, { contacts });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/contacts") {
      const body = await readJsonBody(req);
      const contact = await createContact(body);
      sendJson(res, { contact }, 201);
      return;
    }

    const contactMatch = url.pathname.match(/^\/api\/contacts\/(\d+)$/);
    if (req.method === "GET" && contactMatch) {
      const contact = await getContact(Number(contactMatch[1]));
      if (!contact) {
        sendJson(res, { error: "Contact not found" }, 404);
        return;
      }
      sendJson(res, { contact });
      return;
    }
    if (req.method === "PUT" && contactMatch) {
      const body = await readJsonBody(req);
      const contact = await updateContact(Number(contactMatch[1]), body);
      sendJson(res, { contact });
      return;
    }
    if (req.method === "DELETE" && contactMatch) {
      await deleteContact(Number(contactMatch[1]));
      sendNoContent(res);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/addresses") {
      const addresses = await listAddresses();
      sendJson(res, { addresses });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/addresses") {
      const body = await readJsonBody(req);
      const address = await createAddress(body);
      sendJson(res, { address }, 201);
      return;
    }

    const addressMatch = url.pathname.match(/^\/api\/addresses\/(\d+)$/);
    if (req.method === "GET" && addressMatch) {
      const address = await getAddress(Number(addressMatch[1]));
      if (!address) {
        sendJson(res, { error: "Address not found" }, 404);
        return;
      }
      sendJson(res, { address });
      return;
    }
    if (req.method === "PUT" && addressMatch) {
      const body = await readJsonBody(req);
      const address = await updateAddress(Number(addressMatch[1]), body);
      sendJson(res, { address });
      return;
    }
    if (req.method === "DELETE" && addressMatch) {
      await deleteAddress(Number(addressMatch[1]));
      sendNoContent(res);
      return;
    }

    const addressCoordsMatch = url.pathname.match(
      /^\/api\/addresses\/(\d+)\/coordinates$/,
    );
    if (req.method === "PATCH" && addressCoordsMatch) {
      const body = await readJsonBody(req);
      const address = await patchAddressCoordinates(
        Number(addressCoordsMatch[1]),
        body,
      );
      sendJson(res, { address });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/places/autocomplete") {
      const body = (await readJsonBody(req)) ?? {};
      const input =
        body && typeof body === "object" && "input" in body
          ? String(body.input ?? "")
          : "";
      const sessionToken =
        body && typeof body === "object" && "sessionToken" in body
          ? String(body.sessionToken ?? "").trim() || undefined
          : undefined;
      const result = await autocompletePlaces(input, sessionToken);
      sendJson(res, result);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/places/details") {
      const body = (await readJsonBody(req)) ?? {};
      const placeId =
        body && typeof body === "object" && "placeId" in body
          ? String(body.placeId ?? "").trim()
          : "";
      if (!placeId) {
        sendJson(res, { error: "placeId is required" }, 400);
        return;
      }
      const sessionToken =
        body && typeof body === "object" && "sessionToken" in body
          ? String(body.sessionToken ?? "").trim() || undefined
          : undefined;
      const place = await getPlaceDetails(placeId, sessionToken);
      sendJson(res, place);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/places/viewport-hint") {
      const body = (await readJsonBody(req)) ?? {};
      const hint = await fetchViewportHint(body);
      sendJson(res, hint);
      return;
    }

    const taskCoordsMatch = url.pathname.match(
      /^\/api\/tasks\/(\d+)\/destination-coordinates$/,
    );
    if (req.method === "PATCH" && taskCoordsMatch) {
      const body = await readJsonBody(req);
      const task = await patchTaskDestinationCoordinates(
        Number(taskCoordsMatch[1]),
        body,
      );
      sendJson(res, { task });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/users") {
      const role = (url.searchParams.get("role") ?? "").trim() || null;
      const users = await listUsers(role);
      sendJson(res, { users });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/users") {
      const body = (await readJsonBody(req)) ?? {};
      const actorUserId = await resolveActorUserId(req, body);
      const user = await createUser(body, actorUserId);
      sendJson(res, { user }, 201);
      return;
    }

    const userPatchMatch = url.pathname.match(
      /^\/api\/users\/([0-9a-fA-F-]{36})$/,
    );
    if (req.method === "PATCH" && userPatchMatch) {
      const body = (await readJsonBody(req)) ?? {};
      const actorUserId = await resolveActorUserId(req, body);
      const user = await updateUser(userPatchMatch[1], body, actorUserId);
      sendJson(res, { user });
      return;
    }
    if (req.method === "DELETE" && userPatchMatch) {
      const body = (await readJsonBody(req)) ?? {};
      const actorUserId = await resolveActorUserId(req, body);
      await deactivateUser(userPatchMatch[1], actorUserId);
      sendNoContent(res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/mobile/activate") {
      const body = await readJsonBody(req);
      const result = await activateMobileDevice(body ?? {});
      sendJson(res, {
        deviceSessionToken: result.deviceSessionToken,
        userId: result.userId,
        displayName: result.displayName,
        role: result.role,
        permissions: result.permissions,
        deviceId: result.deviceId,
        activatedAt: result.activatedAt,
      });
      return;
    }

    const mobileActivationMatch = url.pathname.match(
      /^\/api\/users\/([0-9a-fA-F-]{36})\/mobile-activations$/,
    );
    if (req.method === "POST" && mobileActivationMatch) {
      const body = (await readJsonBody(req)) ?? {};
      const createdByUserId = await resolveActorUserId(req, body);
      const result = await issueActivationCode({
        userId: mobileActivationMatch[1],
        createdByUserId,
      });
      sendJson(
        res,
        {
          id: result.id,
          code: result.code,
          expiresAt: result.expiresAt,
          userId: result.userId,
          displayName: result.displayName,
        },
        201,
      );
      return;
    }

    const mobileDevicesMatch = url.pathname.match(
      /^\/api\/users\/([0-9a-fA-F-]{36})\/mobile-devices$/,
    );
    if (mobileDevicesMatch) {
      const userId = mobileDevicesMatch[1];
      if (req.method === "GET") {
        const actorUserId = await resolveActorUserId(
          req,
          {},
          url.searchParams.get("actorUserId") ?? "",
        );
        const devices = await listMobileDevices({
          userId,
          actorUserId,
          includeRevoked: url.searchParams.get("includeRevoked") === "1",
        });
        sendJson(res, { devices });
        return;
      }
      if (req.method === "DELETE") {
        const body = (await readJsonBody(req)) ?? {};
        const revokedByUserId = await resolveActorUserId(req, body);
        const result = await revokeAllMobileDevices({
          userId,
          revokedByUserId,
        });
        sendJson(res, result);
        return;
      }
    }

    const mobileDeviceMatch = url.pathname.match(
      /^\/api\/users\/([0-9a-fA-F-]{36})\/mobile-devices\/([0-9a-fA-F-]{36})$/,
    );
    if (req.method === "DELETE" && mobileDeviceMatch) {
      const body = (await readJsonBody(req)) ?? {};
      const revokedByUserId = await resolveActorUserId(req, body);
      const device = await revokeMobileDevice({
        userId: mobileDeviceMatch[1],
        deviceId: mobileDeviceMatch[2],
        revokedByUserId,
      });
      sendJson(res, { device });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/crew-locations") {
      const actorUserId = await resolveActorUserId(
        req,
        {},
        url.searchParams.get("actorUserId") ?? "",
      );
      if (!actorUserId) {
        throw Object.assign(new Error("Unauthorized"), { status: 401 });
      }
      await assertPermission(actorUserId, PERMISSIONS.viewCrewMap);
      const locations = await listCrewLocations();
      sendJson(res, { locations });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/health") {
      sendJson(res, { ok: true });
      return;
    }

    const localStorageKey = storageKeyFromLocalPath(url.pathname);
    if (localStorageKey?.startsWith("attachments/")) {
      if (req.method === "PUT") {
        const taskMatch = localStorageKey.match(/^attachments\/(\d+)\//);
        if (!taskMatch) {
          sendJson(res, { error: "Invalid storage path" }, 400);
          return;
        }
        const taskId = Number(taskMatch[1]);
        if (!isValidAttachmentKeyForTask(taskId, localStorageKey)) {
          sendJson(res, { error: "Invalid storage key" }, 400);
          return;
        }
        const body = await readRawBody(req);
        const mimeType = String(req.headers["content-type"] || "application/octet-stream");
        await putLocalObject(localStorageKey, body, mimeType);
        sendNoContent(res);
        return;
      }
      if (req.method === "GET") {
        const fileName = url.searchParams.get("fileName");
        const inline = url.searchParams.get("inline") === "1";
        const contentType = url.searchParams.get("contentType");
        const { buf, headers } = await readLocalObjectResponse(localStorageKey, {
          fileName,
          inline,
          contentType,
        });
        res.writeHead(200, { ...headers, ...CORS_HEADERS });
        res.end(buf);
        return;
      }
    }

    if (req.method === "GET" && url.pathname === "/api/document-types") {
      sendJson(res, { documentTypes: listDocumentTypes() });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/print-templates") {
      const context = url.searchParams.get("context") ?? undefined;
      const surface = url.searchParams.get("surface") ?? undefined;
      if (!(await isPrintConfigured()) && context === "task" && surface === "taskMenu") {
        sendJson(res, { templates: [] });
        return;
      }
      sendJson(res, {
        templates: await listPrintTemplates({ context, surface }),
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/org/print-templates") {
      sendJson(res, await getOrgPrintTemplatesPayload(1));
      return;
    }

    const printMatch = url.pathname.match(/^\/api\/print\/([\w-]+)$/);
    if (req.method === "POST" && printMatch) {
      const documentType = printMatch[1];
      const body = (await readJsonBody(req)) ?? {};

      // @ts-ignore auth attached by requireWebAuth when web auth is on
      const auth = req.auth;
      let generatedByUserId = null;
      if (auth?.identity) {
        const user = await upsertUserFromVerifiedIdentity(auth.identity);
        generatedByUserId = user.id;
      } else if (auth && typeof auth.userId === "string" && auth.userId.trim()) {
        generatedByUserId = auth.userId.trim();
      }

      const { buffer, fileName } = await renderPrint(documentType, body, {
        getTask,
        generatedByUserId,
        orgId: 1,
      });
      const disposition =
        url.searchParams.get("download") === "1" ? "attachment" : "inline";
      sendPdf(res, buffer, fileName, disposition);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/org/settings") {
      const settings = await getOrgSettings();
      sendJson(res, settings);
      return;
    }

    if (req.method === "PUT" && url.pathname === "/api/org/settings") {
      assertOrgConfiguration(req);
      const body = (await readJsonBody(req)) ?? {};
      const actorUserId = await resolveActorUserId(req, body);
      const settings = await updateOrgSettings(body, actorUserId);
      sendJson(res, settings);
      return;
    }

    const importTemplateMatch = url.pathname.match(
      /^\/api\/import\/(contacts|addresses|users)\/template$/,
    );
    if (req.method === "GET" && importTemplateMatch) {
      const entity = importTemplateMatch[1];
      if (!isImportEntity(entity)) {
        sendJson(res, { error: "Invalid entity" }, 400);
        return;
      }
      const actorUserId = await resolveActorUserId(
        req,
        {},
        url.searchParams.get("actorUserId") ?? "",
      );
      await assertPermission(actorUserId, PERMISSIONS.manageOrg);
      const mode = parseImportMode(url.searchParams.get("mode") ?? "blank");
      const { csv, fileName } = await getImportTemplate(entity, mode);
      sendCsv(res, csv, fileName);
      return;
    }

    const importPreviewMatch = url.pathname.match(
      /^\/api\/import\/(contacts|addresses|users)\/preview$/,
    );
    if (req.method === "POST" && importPreviewMatch) {
      const entity = importPreviewMatch[1];
      if (!isImportEntity(entity)) {
        sendJson(res, { error: "Invalid entity" }, 400);
        return;
      }
      const actorUserId = await resolveActorUserId(
        req,
        {},
        url.searchParams.get("actorUserId") ?? "",
      );
      await assertPermission(actorUserId, PERMISSIONS.manageOrg);
      const fileBuf = await readMultipartCsv(req);
      const csvText = fileBuf.toString("utf8");
      const result = await previewImport(entity, csvText);
      sendJson(res, result);
      return;
    }

    const importApplyMatch = url.pathname.match(
      /^\/api\/import\/(contacts|addresses|users)\/apply$/,
    );
    if (req.method === "POST" && importApplyMatch) {
      const entity = importApplyMatch[1];
      if (!isImportEntity(entity)) {
        sendJson(res, { error: "Invalid entity" }, 400);
        return;
      }
      const body = (await readJsonBody(req)) ?? {};
      const actorUserId = await resolveActorUserId(req, body);
      await assertPermission(actorUserId, PERMISSIONS.manageOrg);
      const rows = Array.isArray(body.rows) ? body.rows : [];
      const result = await applyImport(entity, rows, actorUserId);
      sendJson(res, result);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/tasks") {
      const { crewMemberId, createdByUserId } =
        await resolveScopedTaskListFilters(req, url.searchParams);
      const tasks = await listTasks({ crewMemberId, createdByUserId });
      sendJson(res, { tasks });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/tasks/lookup") {
      const q = (url.searchParams.get("q") ?? "").trim();
      if (!q) {
        sendJson(res, { error: "Query is required" }, 400);
        return;
      }
      const taskId = await lookupTaskByQuery(q);
      if (taskId == null) {
        sendJson(res, { error: "Task not found" }, 404);
        return;
      }
      await assertTaskViewAccess(req, taskId);
      sendJson(res, { taskId });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/routes/optimize") {
      const { optimizeTaskRoute } = await import("./routeOptimize.mjs");
      const body = (await readJsonBody(req)) ?? {};
      const result = await optimizeTaskRoute(body);
      sendJson(res, result);
      return;
    }

    const attachmentPresignMatch = url.pathname.match(
      /^\/api\/tasks\/(\d+)\/attachments\/presign$/,
    );
    if (req.method === "POST" && attachmentPresignMatch) {
      const taskId = Number(attachmentPresignMatch[1]);
      await assertTaskViewAccess(req, taskId);
      const body = await readJsonBody(req);
      const result = await createPresign(taskId, body);
      sendJson(res, result);
      return;
    }

    const attachmentUrlMatch = url.pathname.match(
      /^\/api\/tasks\/(\d+)\/attachments\/(\d+)\/url$/,
    );
    if (req.method === "GET" && attachmentUrlMatch) {
      const taskId = Number(attachmentUrlMatch[1]);
      await assertTaskViewAccess(req, taskId);
      const attachmentId = Number(attachmentUrlMatch[2]);
      const inline = url.searchParams.get("inline") === "1";
      const result = await getAttachmentDownloadUrl(taskId, attachmentId, {
        inline,
      });
      sendJson(res, result);
      return;
    }

    const attachmentItemMatch = url.pathname.match(
      /^\/api\/tasks\/(\d+)\/attachments\/(\d+)$/,
    );
    if (req.method === "DELETE" && attachmentItemMatch) {
      const taskId = Number(attachmentItemMatch[1]);
      const attachmentId = Number(attachmentItemMatch[2]);
      await deleteAttachment(taskId, attachmentId);
      sendNoContent(res);
      return;
    }

    const attachmentsMatch = url.pathname.match(
      /^\/api\/tasks\/(\d+)\/attachments$/,
    );
    if (req.method === "GET" && attachmentsMatch) {
      const taskId = Number(attachmentsMatch[1]);
      await assertTaskViewAccess(req, taskId);
      const attachments = await listAttachments(taskId);
      sendJson(res, { attachments });
      return;
    }
    if (req.method === "POST" && attachmentsMatch) {
      const taskId = Number(attachmentsMatch[1]);
      const body = await readJsonBody(req);
      const attachment = await confirmAttachment(taskId, body);
      sendJson(res, { attachment }, 201);
      return;
    }

    const taskStatusMatch = url.pathname.match(/^\/api\/tasks\/(\d+)\/status$/);
    if (req.method === "PATCH" && taskStatusMatch) {
      const taskId = Number(taskStatusMatch[1]);
      await assertTaskActorForMutation(req, taskId);
      const body = await readJsonBody(req);
      const task = await updateTaskStatus(taskId, body, {
        actor: resolveTaskActor(req),
      });
      sendJson(res, { task });
      return;
    }

    const taskRestoreMatch = url.pathname.match(/^\/api\/tasks\/(\d+)\/restore$/);
    if (req.method === "POST" && taskRestoreMatch) {
      const task = await restoreTask(Number(taskRestoreMatch[1]));
      sendJson(res, { task });
      return;
    }

    const taskCloneMatch = url.pathname.match(/^\/api\/tasks\/(\d+)\/clone$/);
    if (req.method === "POST" && taskCloneMatch) {
      const sourceTaskId = Number(taskCloneMatch[1]);
      await assertTaskViewAccess(req, sourceTaskId);
      const body = await readJsonBody(req);
      const task = await cloneTask(sourceTaskId, body);
      sendJson(res, { task }, 201);
      return;
    }

    const crewEventsMatch = url.pathname.match(
      /^\/api\/tasks\/(\d+)\/crew-events$/,
    );
    if (req.method === "POST" && crewEventsMatch) {
      const taskId = Number(crewEventsMatch[1]);
      await assertTaskActorForMutation(req, taskId);
      const body = await readJsonBody(req);
      const result = await createCrewEvent(taskId, body, {
        actor: resolveTaskActor(req),
      });
      sendJson(res, result, 201);
      return;
    }

    const taskHistoryMatch = url.pathname.match(
      /^\/api\/tasks\/(\d+)\/history$/,
    );
    if (req.method === "GET" && taskHistoryMatch) {
      const historyTaskId = Number(taskHistoryMatch[1]);
      await assertTaskViewAccess(req, historyTaskId);
      const events = await getTaskHistory(historyTaskId);
      sendJson(res, { events });
      return;
    }

    const taskMatch = url.pathname.match(/^\/api\/tasks\/(\d+)$/);
    if (req.method === "GET" && taskMatch) {
      const detailTaskId = Number(taskMatch[1]);
      await assertTaskViewAccess(req, detailTaskId);
      const task = await getTask(detailTaskId);
      if (!task) {
        sendJson(res, { error: "Task not found" }, 404);
        return;
      }
      const attachments = await listAttachments(detailTaskId);
      sendJson(res, { task: { ...task, attachments } });
      return;
    }
    if (req.method === "PUT" && taskMatch) {
      const body = await readJsonBody(req);
      const task = await updateTask(Number(taskMatch[1]), body);
      sendJson(res, { task });
      return;
    }
    if (req.method === "DELETE" && taskMatch) {
      await cancelTask(Number(taskMatch[1]));
      sendNoContent(res);
      return;
    }


    if (req.method === "POST" && url.pathname === "/api/tasks") {
      const body = await readJsonBody(req);
      const task = await createTask(body);
      sendJson(res, { task }, 201);
      return;
    }

    sendJson(res, { error: "Not found" }, 404);
  } catch (err) {
    console.error(err);
    const status =
      err && typeof err === "object" && "status" in err && typeof err.status === "number"
        ? err.status
        : 500;
    sendJson(
      res,
      { error: err instanceof Error ? err.message : "Server error" },
      status,
    );
  }
});

server.listen(PORT, () => {
  void (async () => {
    const authMode = (await isWebAuthEnabled())
      ? `web SSO (${(await getWebAuthPublicConfig()).provider})`
      : "stub (no JWT)";
    console.log(`Field API listening on http://localhost:${PORT} — auth: ${authMode}`);
  })();
  startCancelledTaskPurgeScheduler();
});
