import { getPool } from "./db.mjs";
import {
  CUSTOM_FIELD_LOOKUP_TABLES,
  isValidCustomFieldSlot,
  normalizeCustomFieldOptions,
} from "./customFields.mjs";
import { normalizeShowWhen } from "../shared/customFieldShowWhen.js";
import { PERMISSIONS, assertPermission } from "./permissions.mjs";
import {
  normalizeEntraWebAuthConfig,
  webAuthProviderForDb,
  webAuthSourceFromDb,
} from "../shared/webAuthConfig.js";
import { invalidateWebAuthSettingsCache } from "./auth/webAuthSettings.mjs";
import {
  normalizeRequiredTaskFields,
  requiredTaskFieldsFromDb,
} from "../shared/requiredTaskFields.js";
import {
  assertCustomFieldEntity,
  byCustomFieldEntity,
  isCustomFieldEntity,
} from "../shared/customFieldEntities.js";
import {
  normalizeTrackingPageTemplate,
  trackingPageTemplateFromDb,
} from "../shared/trackingPageTemplate.js";
import { computeOrgPrintTemplatesRevision } from "./orgPrintTemplates.mjs";
import { normalizeAccentHex, parseAccentHexOrThrow } from "../shared/orgAccent.js";

/** @typedef {import("../shared/trackingPageTemplate.js").TrackingPageTemplate} TrackingPageTemplate */
/** @typedef {{ id: number, name: string, slug: string, icon: string, enabled: boolean, sortOrder: number, pluralName: string, trackingPageTemplate: TrackingPageTemplate }} OrgTaskType */
/** @typedef {{ slot: number, label: string, dataType: string, required: boolean, lookupTable: string | null, options: string[], showWhen: { taskTypeNames: string[] } | null }} OrgCustomFieldDef */
/** @typedef {{
 *   externalKeyLabel: string,
 *   cancelRetentionDays: number | null,
 *   requiredTaskFields: string[],
 *   webAuthSource: import("../shared/webAuthConfig.js").WebAuthSource,
 *   webAuthConfig: import("../shared/webAuthConfig.js").EntraWebAuthConfig,
 *   taskTypes: OrgTaskType[],
 *   customFieldDefs: Record<string, OrgCustomFieldDef[]>,
 *   printTemplatesRevision: string,
 *   accentColor: string,
 * }} OrgConfig */

const CACHE_TTL_MS = 30_000;

/** @type {{ data: OrgConfig | null, expiresAt: number }} */
const cache = { data: null, expiresAt: 0 };

const ALLOWED_DATA_TYPES = new Set([
  "text",
  "number",
  "boolean",
  "date",
  "lookup",
  "select",
  "multiselect",
]);
const ALLOWED_RETENTION_DAYS = new Set([3, 7, 14, 30]);

/**
 * @param {import('pg').QueryResultRow} row
 */
function mapTaskTypeRow(row) {
  const name = String(row.name);
  return {
    id: Number(row.id),
    name,
    slug: String(row.slug),
    icon: String(row.icon ?? "CircleHelp"),
    enabled: Boolean(row.enabled),
    sortOrder: Number(row.sort_order ?? 0),
    pluralName: row.plural_name != null ? String(row.plural_name) : "",
    trackingPageTemplate: trackingPageTemplateFromDb(
      row.tracking_page_template,
      name,
    ),
  };
}

/**
 * @param {import('pg').QueryResultRow} row
 */
function mapCustomFieldRow(row) {
  return {
    slot: Number(row.slot),
    label: String(row.label ?? ""),
    dataType: String(row.data_type ?? "text"),
    required: Boolean(row.required),
    lookupTable: row.lookup_table != null ? String(row.lookup_table) : null,
    options: normalizeCustomFieldOptions(row.options),
    showWhen: normalizeShowWhen(row.show_when),
  };
}

export function invalidateOrgSettingsCache() {
  cache.data = null;
  cache.expiresAt = 0;
}

/**
 * @returns {Promise<OrgConfig>}
 */
export async function getOrgSettings() {
  const now = Date.now();
  if (cache.data && cache.expiresAt > now) {
    return cache.data;
  }

  const pool = getPool();
  const [settingsRes, taskTypesRes, customFieldsRes, printTemplatesRevision] =
    await Promise.all([
    pool.query(
      `SELECT external_key_label, cancel_retention_days, required_task_fields,
              web_auth_provider, web_auth_config, accent_color
       FROM org_settings
       WHERE id = 1`,
    ),
    pool.query(
      `SELECT id, name, slug, icon, enabled, sort_order, plural_name, tracking_page_template
       FROM org_task_types
       WHERE retired_at IS NULL
       ORDER BY sort_order ASC, id ASC`,
    ),
    pool.query(
      `SELECT entity_type, slot, label, data_type, required, lookup_table, options, show_when
       FROM org_custom_field_defs
       ORDER BY entity_type ASC, slot ASC`,
    ),
    computeOrgPrintTemplatesRevision(1),
  ]);

  /** @type {Record<string, OrgCustomFieldDef[]>} */
  const customFieldDefs = byCustomFieldEntity(() => []);
  for (const row of customFieldsRes.rows) {
    const entity = String(row.entity_type ?? "task");
    if (!isCustomFieldEntity(entity)) continue;
    customFieldDefs[entity].push(mapCustomFieldRow(row));
  }

  const settingsRow = settingsRes.rows[0];
  /** @type {OrgConfig} */
  const data = {
    externalKeyLabel: settingsRow?.external_key_label ?? "Job",
    cancelRetentionDays:
      settingsRow?.cancel_retention_days != null
        ? Number(settingsRow.cancel_retention_days)
        : null,
    requiredTaskFields: requiredTaskFieldsFromDb(
      settingsRow?.required_task_fields,
    ),
    webAuthSource: webAuthSourceFromDb(settingsRow?.web_auth_provider),
    webAuthConfig: normalizeEntraWebAuthConfig(settingsRow?.web_auth_config),
    taskTypes: taskTypesRes.rows.map(mapTaskTypeRow),
    customFieldDefs,
    printTemplatesRevision,
    accentColor: normalizeAccentHex(settingsRow?.accent_color),
  };

  cache.data = data;
  cache.expiresAt = now + CACHE_TTL_MS;
  return data;
}


/**
 * @param {unknown} value
 * @returns {string}
 */
function asString(value) {
  if (value == null) return "";
  return String(value).trim();
}

/**
 * @param {unknown} value
 */
function asBool(value) {
  if (typeof value === "boolean") return value;
  return value === true || value === "true" || value === 1 || value === "1";
}

/**
 * @param {unknown} value
 * @returns {number | null}
 */
function asNullableInt(value) {
  if (value === null || value === "never" || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

/**
 * @param {import('pg').PoolClient} client
 * @param {string} baseSlug
 */
async function uniqueActiveTaskTypeSlug(client, baseSlug) {
  let slug = baseSlug || "type";
  let counter = 2;
  while (true) {
    const { rowCount } = await client.query(
      `SELECT 1 FROM org_task_types WHERE slug = $1 AND retired_at IS NULL`,
      [slug],
    );
    if (!rowCount) return slug;
    const suffix = `-${counter}`;
    slug = `${baseSlug.slice(0, 100 - suffix.length)}${suffix}`;
    counter += 1;
  }
}

/**
 * @param {string} taskType
 * @param {OrgConfig} [org]
 */
export function isEnabledTaskType(taskType, org) {
  const name = String(taskType ?? "").trim();
  if (!name) return false;
  const types = org?.taskTypes ?? [];
  if (types.length === 0) return true;
  return types.some((t) => t.enabled && (t.name === name || t.slug === name));
}

/**
 * @param {number} taskTypeId
 * @param {OrgConfig} org
 */
export function isActiveTaskTypeId(taskTypeId, org) {
  const id = Number(taskTypeId);
  if (!Number.isInteger(id) || id < 1) return false;
  return org.taskTypes.some((t) => t.id === id && t.enabled);
}

/**
 * @param {string} name
 * @returns {string}
 */
export function slugifyTaskType(name) {
  const clean = String(name ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return clean || "type";
}

/**
 * @param {unknown[]} taskTypes
 */
export function normalizeAndValidateTaskTypes(taskTypes) {
  const result = [];
  const seenNames = new Set();
  const seenSlugs = new Set();
  let order = 0;

  for (const raw of taskTypes) {
    if (!raw || typeof raw !== "object") continue;
    const row = /** @type {Record<string, unknown>} */ (raw);
    const name = asString(row.name).trim();

    if (!name) {
      throw Object.assign(new Error("Each task type must have a name"), {
        status: 400,
      });
    }

    if (name.length > 100) {
      throw Object.assign(
        new Error("Task type name must be 100 characters or less"),
        { status: 400 },
      );
    }

    if (!/[a-zA-Z0-9]/.test(name)) {
      throw Object.assign(
        new Error(
          `Task type "${name}" must contain at least one letter or number`,
        ),
        { status: 400 },
      );
    }

    const lowerName = name.toLowerCase();
    if (seenNames.has(lowerName)) {
      throw Object.assign(
        new Error(`Duplicate task type name: "${name}"`),
        { status: 400 },
      );
    }
    seenNames.add(lowerName);

    const baseSlug = slugifyTaskType(name);
    let slug = baseSlug;
    let counter = 2;
    while (seenSlugs.has(slug)) {
      const suffix = `-${counter}`;
      slug = `${baseSlug.slice(0, 100 - suffix.length)}${suffix}`;
      counter++;
    }
    seenSlugs.add(slug);

    const pluralName = asString(row.pluralName);
    if (pluralName.length > 100) {
      throw Object.assign(
        new Error("Task type plural name must be 100 characters or less"),
        { status: 400 },
      );
    }

    result.push({
      name,
      slug,
      icon: asString(row.icon) || "CircleHelp",
      enabled: asBool(row.enabled ?? true),
      sortOrder: typeof row.sortOrder === "number" ? row.sortOrder : order,
      pluralName,
    });
    order++;
  }

  return result;
}

/**
 * @param {import('pg').PoolClient} client
 * @param {unknown[]} rawTypes
 */
async function syncTaskTypes(client, rawTypes) {
  normalizeAndValidateTaskTypes(rawTypes);

  const { rows: activeRows } = await client.query(
    `SELECT id, name, slug, icon, enabled, sort_order, plural_name, tracking_page_template
     FROM org_task_types
     WHERE retired_at IS NULL`,
  );
  /** @type {Map<number, import('pg').QueryResultRow>} */
  const activeById = new Map(activeRows.map((r) => [Number(r.id), r]));
  /** @type {Set<number>} */
  const seenActiveIds = new Set();

  let order = 0;
  for (const raw of rawTypes) {
    if (!raw || typeof raw !== "object") continue;
    const row = /** @type {Record<string, unknown>} */ (raw);
    const name = asString(row.name).trim();
    if (!name) continue;

    const id =
      row.id != null && Number.isInteger(Number(row.id)) ? Number(row.id) : null;
    const enabled = asBool(row.enabled ?? true);
    const icon = asString(row.icon) || "CircleHelp";
    const pluralName = asString(row.pluralName) || null;
    const sortOrder = typeof row.sortOrder === "number" ? row.sortOrder : order;
    let trackingPageTemplateJson = null;
    if (row.trackingPageTemplate != null) {
      try {
        const normalized = normalizeTrackingPageTemplate(row.trackingPageTemplate, name);
        trackingPageTemplateJson = JSON.stringify(normalized);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Invalid trackingPageTemplate";
        throw Object.assign(new Error(message), { status: 400 });
      }
    }

    if (!enabled) {
      if (id != null && activeById.has(id)) {
        await client.query(
          `UPDATE org_task_types SET retired_at = now() WHERE id = $1 AND retired_at IS NULL`,
          [id],
        );
        seenActiveIds.add(id);
      }
      order += 1;
      continue;
    }

    if (id != null && activeById.has(id)) {
      const existing = activeById.get(id);
      const changed =
        String(existing.name) !== name ||
        String(existing.icon ?? "CircleHelp") !== icon;

      const templateToStore =
        trackingPageTemplateJson ??
        (existing.tracking_page_template != null
          ? JSON.stringify(existing.tracking_page_template)
          : null);

      if (!changed) {
        await client.query(
          `UPDATE org_task_types
           SET sort_order = $2, plural_name = $3, tracking_page_template = $4::jsonb
           WHERE id = $1`,
          [id, sortOrder, pluralName, templateToStore],
        );
        seenActiveIds.add(id);
      } else {
        await client.query(
          `UPDATE org_task_types SET retired_at = now() WHERE id = $1 AND retired_at IS NULL`,
          [id],
        );
        seenActiveIds.add(id);
        const slug = await uniqueActiveTaskTypeSlug(client, slugifyTaskType(name));
        await client.query(
          `INSERT INTO org_task_types
             (name, slug, icon, enabled, sort_order, plural_name, tracking_page_template)
           VALUES ($1, $2, $3, true, $4, $5, $6::jsonb)`,
          [name, slug, icon, sortOrder, pluralName, templateToStore],
        );
      }
    } else {
      const slug = await uniqueActiveTaskTypeSlug(client, slugifyTaskType(name));
      await client.query(
        `INSERT INTO org_task_types
           (name, slug, icon, enabled, sort_order, plural_name, tracking_page_template)
         VALUES ($1, $2, $3, true, $4, $5, $6::jsonb)`,
        [name, slug, icon, sortOrder, pluralName, trackingPageTemplateJson],
      );
    }
    order += 1;
  }

  for (const id of activeById.keys()) {
    if (!seenActiveIds.has(id)) {
      await client.query(
        `UPDATE org_task_types SET retired_at = now() WHERE id = $1 AND retired_at IS NULL`,
        [id],
      );
    }
  }
}

/**
 * Full replace of one entity's custom field defs.
 * @param {import('pg').PoolClient} client
 * @param {string} entityType
 * @param {unknown[]} rawDefs
 */
async function syncCustomFieldDefs(client, entityType, rawDefs) {
  await client.query(
    `DELETE FROM org_custom_field_defs WHERE entity_type = $1`,
    [entityType],
  );

  const usedSlots = new Set();
  for (const raw of rawDefs) {
    if (!raw || typeof raw !== "object") continue;
    const row = /** @type {Record<string, unknown>} */ (raw);
    const slot = Number(row.slot);
    if (!isValidCustomFieldSlot(slot)) {
      throw Object.assign(
        new Error("customFieldDefs slot must be a positive integer"),
        { status: 400 },
      );
    }
    if (usedSlots.has(slot)) {
      throw Object.assign(
        new Error("customFieldDefs slot values must be unique"),
        { status: 400 },
      );
    }
    usedSlots.add(slot);
    const dataType = asString(row.dataType) || "text";
    if (!ALLOWED_DATA_TYPES.has(dataType)) {
      throw Object.assign(new Error(`Invalid dataType: ${dataType}`), {
        status: 400,
      });
    }
    const label = asString(row.label);
    if (!label) continue;
    const lookupTable = asString(row.lookupTable) || null;
    if (dataType === "lookup") {
      if (!lookupTable || !CUSTOM_FIELD_LOOKUP_TABLES.has(lookupTable)) {
        throw Object.assign(
          new Error(
            "lookup fields require lookupTable: users, contacts, addresses, or tasks",
          ),
          { status: 400 },
        );
      }
    }
    const options = normalizeCustomFieldOptions(row.options);
    if (dataType === "select" || dataType === "multiselect") {
      if (options.length === 0) {
        throw Object.assign(
          new Error(`${label} requires at least one option`),
          { status: 400 },
        );
      }
    }
    const showWhen =
      entityType === "task" ? normalizeShowWhen(row.showWhen) : null;
    await client.query(
      `INSERT INTO org_custom_field_defs
         (entity_type, slot, label, data_type, required, lookup_table, options, show_when)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb)`,
      [
        entityType,
        slot,
        label,
        dataType,
        asBool(row.required ?? false),
        dataType === "lookup" ? lookupTable : null,
        JSON.stringify(
          dataType === "select" || dataType === "multiselect" ? options : [],
        ),
        showWhen ? JSON.stringify(showWhen) : null,
      ],
    );
  }
}

/**
 * @param {Record<string, unknown>} body
 * @param {string} actorUserId
 * @returns {Promise<OrgConfig>}
 */
export async function updateOrgSettings(body, actorUserId) {
  await assertPermission(actorUserId, PERMISSIONS.manageOrg);
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    if (body.settings && typeof body.settings === "object") {
      const settings = /** @type {Record<string, unknown>} */ (body.settings);
      const externalKeyLabel =
        settings.externalKeyLabel != null
          ? asString(settings.externalKeyLabel) || "Job"
          : null;
      let cancelRetentionDays;
      if ("cancelRetentionDays" in settings) {
        cancelRetentionDays = asNullableInt(settings.cancelRetentionDays);
        if (
          cancelRetentionDays != null &&
          !ALLOWED_RETENTION_DAYS.has(cancelRetentionDays)
        ) {
          throw Object.assign(
            new Error("cancelRetentionDays must be 3, 7, 14, 30, or null"),
            { status: 400 },
          );
        }
      }

      const sets = [];
      /** @type {unknown[]} */
      const params = [];
      let i = 1;
      if (externalKeyLabel != null) {
        sets.push(`external_key_label = $${i++}`);
        params.push(externalKeyLabel);
      }
      if ("cancelRetentionDays" in settings) {
        sets.push(`cancel_retention_days = $${i++}`);
        params.push(cancelRetentionDays);
      }
      if ("requiredTaskFields" in settings) {
        sets.push(`required_task_fields = $${i++}`);
        params.push(normalizeRequiredTaskFields(settings.requiredTaskFields));
      }
      if ("accentColor" in settings) {
        sets.push(`accent_color = $${i++}`);
        params.push(parseAccentHexOrThrow(settings.accentColor));
      }
      if ("webAuthSource" in settings) {
        const source = /** @type {import("../shared/webAuthConfig.js").WebAuthSource} */ (
          settings.webAuthSource
        );
        const entraConfig = normalizeEntraWebAuthConfig(settings.webAuthConfig);
        if (source === "entra" && (!entraConfig.clientId || !entraConfig.tenantId)) {
          throw Object.assign(
            new Error("Entra sign-in requires client ID and tenant ID"),
            { status: 400 },
          );
        }
        sets.push(`web_auth_provider = $${i++}`);
        params.push(webAuthProviderForDb(source));
        sets.push(`web_auth_config = $${i++}::jsonb`);
        params.push(JSON.stringify(source === "entra" ? entraConfig : {}));
      }
      if (sets.length > 0) {
        sets.push("updated_at = now()");
        await client.query(
          `UPDATE org_settings SET ${sets.join(", ")} WHERE id = 1`,
          params,
        );
      }
    }

    if (Array.isArray(body.taskTypes)) {
      await syncTaskTypes(client, body.taskTypes);
    }

    if (body.customFieldDefs && typeof body.customFieldDefs === "object") {
      const byEntity = /** @type {Record<string, unknown>} */ (
        body.customFieldDefs
      );
      for (const entity of Object.keys(byEntity)) {
        assertCustomFieldEntity(entity);
        if (!Array.isArray(byEntity[entity])) continue;
        await syncCustomFieldDefs(client, entity, byEntity[entity]);
      }
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  invalidateOrgSettingsCache();
  invalidateWebAuthSettingsCache();
  return getOrgSettings();
}

/**
 * Exact match lookup on external_key (trimmed).
 * @param {string} query
 * @returns {Promise<number | null>}
 */
export async function lookupTaskByExternalQuery(query) {
  const q = String(query ?? "").trim();
  if (!q) return null;

  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT id FROM tasks
     WHERE deleted_at IS NULL
       AND external_key = $1
     ORDER BY id DESC
     LIMIT 1`,
    [q],
  );
  if (rows.length > 0) return Number(rows[0].id);
  return null;
}

/**
 * @param {import('pg').PoolClient} client
 * @param {number} taskTypeId
 */
export async function loadTaskTypeById(client, taskTypeId) {
  const id = Number(taskTypeId);
  if (!Number.isInteger(id) || id < 1) return null;
  const { rows } = await client.query(
    `SELECT id, name, slug, retired_at
     FROM org_task_types
     WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

/**
 * @param {import('pg').PoolClient} client
 * @param {Record<string, unknown>} body
 * @param {OrgConfig} org
 * @param {{ existingTaskTypeId?: number | null }} [opts]
 */
export async function resolveTaskTypeForWrite(client, body, org, opts = {}) {
  const existingTaskTypeId =
    opts.existingTaskTypeId != null ? Number(opts.existingTaskTypeId) : null;

  let taskTypeId =
    body.taskTypeId != null && body.taskTypeId !== ""
      ? Number(body.taskTypeId)
      : null;
  const taskTypeName = asString(body.taskType);

  if (!taskTypeId && taskTypeName && org.taskTypes.length > 0) {
    const active = org.taskTypes.find(
      (t) => t.enabled && (t.name === taskTypeName || t.slug === taskTypeName),
    );
    if (active) taskTypeId = active.id;
  }

  if (!taskTypeId && existingTaskTypeId) {
    taskTypeId = existingTaskTypeId;
  }

  if (!taskTypeId && taskTypeName) {
    const { rows } = await client.query(
      `SELECT id FROM org_task_types
       WHERE name = $1 OR slug = $1
       ORDER BY retired_at NULLS FIRST, id DESC
       LIMIT 1`,
      [taskTypeName],
    );
    if (rows[0]) taskTypeId = Number(rows[0].id);
  }

  if (!taskTypeId) {
    throw Object.assign(new Error("taskTypeId or taskType is required"), {
      status: 400,
    });
  }

  const row = await loadTaskTypeById(client, taskTypeId);
  if (!row) {
    throw Object.assign(new Error(`Invalid taskTypeId: ${taskTypeId}`), {
      status: 400,
    });
  }

  const isRetired = row.retired_at != null;
  const isExisting = existingTaskTypeId != null && taskTypeId === existingTaskTypeId;

  if (isRetired && !isExisting) {
    const allowRetiredClone =
      asBool(body.allowRetiredTaskType) && taskTypeId === Number(body.taskTypeId);
    if (!allowRetiredClone) {
      throw Object.assign(
        new Error("Cannot assign a retired task type to this task"),
        { status: 400 },
      );
    }
  } else if (!isExisting && !isRetired && org.taskTypes.length > 0) {
    if (!isActiveTaskTypeId(taskTypeId, org)) {
      throw Object.assign(new Error(`Invalid taskType: ${row.name}`), {
        status: 400,
      });
    }
  }

  return {
    taskTypeId,
    taskTypeName: String(row.name),
  };
}
