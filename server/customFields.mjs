/** @typedef {{ slot: number, label: string, dataType: string, required: boolean, lookupTable: string | null, options?: string[], showWhen?: { taskTypeNames: string[] } | null }} CustomFieldDef */

import {
  CUSTOM_FIELD_IMPORT_PLACEHOLDER,
  isCustomFieldImportPlaceholder,
} from "../shared/customFieldPlaceholders.js";
import {
  isCustomFieldVisible,
  normalizeShowWhen,
} from "../shared/customFieldShowWhen.js";

export const CUSTOM_FIELD_DATA_TYPES = new Set([
  "text",
  "number",
  "boolean",
  "date",
  "lookup",
  "select",
  "multiselect",
]);

export const CUSTOM_FIELD_LOOKUP_TABLES = new Set([
  "users",
  "contacts",
  "addresses",
  "tasks",
]);

const TEXT_MAX_LEN = 500;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * @param {unknown} slot
 * @returns {boolean}
 */
export function isValidCustomFieldSlot(slot) {
  return Number.isInteger(slot) && slot >= 1;
}

/**
 * @param {string} message
 * @returns {Error}
 */
function badRequest(message) {
  return Object.assign(new Error(message), { status: 400 });
}

/**
 * @param {unknown} raw
 * @returns {Record<string, unknown>}
 */
function asObject(raw) {
  if (raw == null) return {};
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw badRequest("customFields must be an object keyed by slot");
  }
  return /** @type {Record<string, unknown>} */ (raw);
}

/**
 * @param {unknown} raw
 * @returns {string[]}
 */
export function normalizeCustomFieldOptions(raw) {
  if (!Array.isArray(raw)) return [];
  /** @type {string[]} */
  const out = [];
  const seen = new Set();
  for (const item of raw) {
    const s = String(item ?? "").trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

/**
 * @param {CustomFieldDef} def
 * @returns {string[]}
 */
function fieldOptions(def) {
  return normalizeCustomFieldOptions(def.options);
}

/**
 * @param {unknown} raw
 * @returns {Record<string, string | number | boolean | string[] | null>}
 */
export function normalizeStoredCustomFields(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  /** @type {Record<string, string | number | boolean | string[] | null>} */
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined) continue;
    if (value === null) {
      out[String(key)] = null;
      continue;
    }
    if (Array.isArray(value)) {
      out[String(key)] = normalizeCustomFieldOptions(value);
      continue;
    }
    out[String(key)] =
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
        ? value
        : String(value);
  }
  return out;
}

/**
 * @param {unknown} value
 */
function isEmptyValue(value) {
  return value == null || value === "";
}

/**
 * @param {string} s
 * @returns {string | null}
 */
function parseDateOnly(s) {
  if (!DATE_ONLY.test(s)) return null;
  const [year, month, day] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() !== month - 1 ||
    dt.getUTCDate() !== day
  ) {
    return null;
  }
  return s;
}

/**
 * @param {unknown} raw
 * @param {CustomFieldDef} def
 * @returns {string | number | boolean | string[] | null}
 */
function parseByType(raw, def) {
  if (isEmptyValue(raw)) return null;

  const label = def.label || `Slot ${def.slot}`;

  switch (def.dataType) {
    case "text": {
      const s = String(raw).trim();
      if (!s) return null;
      if (s.length > TEXT_MAX_LEN) {
        throw badRequest(`${label} must be ${TEXT_MAX_LEN} characters or fewer`);
      }
      return s;
    }
    case "number": {
      const n = typeof raw === "number" ? raw : Number(raw);
      if (!Number.isFinite(n)) {
        throw badRequest(`${label} must be a number`);
      }
      return n;
    }
    case "boolean": {
      if (typeof raw === "boolean") return raw;
      if (raw === "true" || raw === 1 || raw === "1") return true;
      if (raw === "false" || raw === 0 || raw === "0") return false;
      throw badRequest(`${label} must be true or false`);
    }
    case "date": {
      const s = String(raw).trim().slice(0, 10);
      const parsed = parseDateOnly(s);
      if (!parsed) {
        throw badRequest(`${label} must be a date (YYYY-MM-DD)`);
      }
      return parsed;
    }
    case "lookup": {
      const id = String(raw).trim();
      if (!id) return null;
      const table = def.lookupTable;
      if (!table || !CUSTOM_FIELD_LOOKUP_TABLES.has(table)) {
        throw badRequest(`${label} lookup table is not configured`);
      }
      if (table === "users") {
        return id;
      }
      const n = Number(id);
      if (!Number.isInteger(n) || n < 1) {
        throw badRequest(`${label} must be a valid ${table} id`);
      }
      return String(n);
    }
    case "select": {
      const options = fieldOptions(def);
      if (options.length === 0) {
        throw badRequest(`${label} has no configured options`);
      }
      const s = String(raw).trim();
      if (!s) return null;
      if (!options.includes(s)) {
        throw badRequest(`${label} must be one of the configured options`);
      }
      return s;
    }
    case "multiselect": {
      const options = fieldOptions(def);
      if (options.length === 0) {
        throw badRequest(`${label} has no configured options`);
      }
      const rawValues = Array.isArray(raw)
        ? raw
        : String(raw)
            .split(",")
            .map((part) => part.trim())
            .filter(Boolean);
      /** @type {string[]} */
      const selected = [];
      const seen = new Set();
      for (const item of rawValues) {
        const s = String(item).trim();
        if (!s || seen.has(s)) continue;
        if (!options.includes(s)) {
          throw badRequest(`${label} contains an invalid option`);
        }
        seen.add(s);
        selected.push(s);
      }
      return selected.length > 0 ? selected : null;
    }
    default:
      throw badRequest(`${label} has an unsupported data type`);
  }
}

/**
 * Validate and coerce create/update payload against org field defs.
 *
 * Bulk import passes `placeholderForRequired` so a blank required cell stores a
 * reserved sentinel instead of failing the row. Every other caller (interactive
 * create/edit) rejects both blanks and the sentinel itself.
 *
 * @param {unknown} raw
 * @param {CustomFieldDef[]} defs
 * @param {{ placeholderForRequired?: boolean, taskTypeName?: unknown }} [opts]
 * @returns {Record<string, string | number | boolean | string[]>}
 */
export function parseCustomFields(raw, defs, opts = {}) {
  const source = asObject(raw);
  const placeholderForRequired = opts.placeholderForRequired === true;
  /** @type {Record<string, string | number | boolean | string[]>} */
  const out = {};
  const list = Array.isArray(defs) ? defs : [];

  for (const def of list) {
    if (!def || !def.label) continue;
    if (!isCustomFieldVisible(def, opts.taskTypeName)) continue;
    const slot = Number(def.slot);
    if (!isValidCustomFieldSlot(slot)) continue;
    const key = String(slot);
    const incoming = source[key] !== undefined ? source[key] : source[slot];
    // The sentinel is never valid input; treat it as an unfilled value.
    const parsed = isCustomFieldImportPlaceholder(incoming)
      ? null
      : parseByType(incoming, def);
    if (def.required && parsed == null) {
      if (!placeholderForRequired) {
        throw badRequest(`${def.label} is required`);
      }
      out[key] = CUSTOM_FIELD_IMPORT_PLACEHOLDER;
      continue;
    }
    if (parsed != null) out[key] = parsed;
  }

  return out;
}

/**
 * Confirm lookup ids exist in the configured catalog table.
 * @param {{ query: (sql: string, params?: unknown[]) => Promise<{ rowCount: number | null, rows: unknown[] }> }} db
 * @param {Record<string, string | number | boolean | string[]>} values
 * @param {CustomFieldDef[]} defs
 */
export async function assertLookupValues(db, values, defs) {
  for (const def of defs ?? []) {
    if (!def || def.dataType !== "lookup") continue;
    const key = String(def.slot);
    const raw = values[key];
    if (raw == null || raw === "") continue;
    if (isCustomFieldImportPlaceholder(raw)) continue;
    const label = def.label || `Slot ${def.slot}`;
    const table = def.lookupTable;
    if (!table || !CUSTOM_FIELD_LOOKUP_TABLES.has(table)) {
      throw badRequest(`${label} lookup table is not configured`);
    }

    if (table === "users") {
      const { rowCount } = await db.query(
        `SELECT 1 FROM users WHERE id = $1::uuid AND is_active = true`,
        [String(raw)],
      );
      if (!rowCount) {
        throw badRequest(`${label} refers to an unknown user`);
      }
      continue;
    }

    const id = Number(raw);
    if (!Number.isInteger(id) || id < 1) {
      throw badRequest(`${label} must be a valid ${table} id`);
    }

    if (table === "contacts") {
      const { rowCount } = await db.query(
        `SELECT 1 FROM contacts WHERE id = $1 AND deleted_at IS NULL`,
        [id],
      );
      if (!rowCount) {
        throw badRequest(`${label} refers to an unknown contact`);
      }
    } else if (table === "addresses") {
      const { rowCount } = await db.query(
        `SELECT 1 FROM addresses WHERE id = $1 AND deleted_at IS NULL`,
        [id],
      );
      if (!rowCount) {
        throw badRequest(`${label} refers to an unknown address`);
      }
    } else if (table === "tasks") {
      const { rowCount } = await db.query(
        `SELECT 1 FROM tasks WHERE id = $1 AND deleted_at IS NULL`,
        [id],
      );
      if (!rowCount) {
        throw badRequest(`${label} refers to an unknown task`);
      }
    }
  }
}

/**
 * Resolve lookup display names for a stored customFields map.
 * @param {{ query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> }} db
 * @param {Record<string, string | number | boolean | string[] | null>} values
 * @param {CustomFieldDef[]} defs
 * @returns {Promise<Record<string, string>>}
 */
/**
 * Build a JSON-serializable snapshot from org field defs (for tasks.custom_field_defs_snapshot).
 * @param {CustomFieldDef[]} defs
 */
export function buildCustomFieldDefsSnapshot(defs) {
  const list = Array.isArray(defs) ? defs : [];
  return list
    .filter((d) => d && String(d.label ?? "").trim())
    .map((d) => ({
      slot: Number(d.slot),
      label: String(d.label),
      dataType: String(d.dataType ?? "text"),
      required: Boolean(d.required),
      lookupTable: d.lookupTable != null ? String(d.lookupTable) : null,
      options: normalizeCustomFieldOptions(d.options),
      showWhen: normalizeShowWhen(d.showWhen),
    }))
    .sort((a, b) => a.slot - b.slot);
}

/**
 * @param {unknown} raw
 * @returns {CustomFieldDef[]}
 */
export function parseCustomFieldDefsSnapshot(raw) {
  if (!Array.isArray(raw)) return [];
  /** @type {CustomFieldDef[]} */
  const out = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = /** @type {Record<string, unknown>} */ (item);
    const slot = Number(row.slot);
    const label = String(row.label ?? "").trim();
    if (!label || !isValidCustomFieldSlot(slot)) continue;
    out.push({
      slot,
      label,
      dataType: String(row.dataType ?? "text"),
      required: Boolean(row.required),
      lookupTable: row.lookupTable != null ? String(row.lookupTable) : null,
      options: normalizeCustomFieldOptions(row.options),
      showWhen: normalizeShowWhen(row.showWhen),
    });
  }
  return out.sort((a, b) => a.slot - b.slot);
}

/**
 * Batch-resolve lookup display names for many tasks (list views).
 * @param {{ query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> }} db
 * @param {Array<{ customFields: Record<string, string | number | boolean | string[] | null>, customFieldDefs: CustomFieldDef[] }>} items
 * @returns {Promise<Record<string, string>[]>}
 */
export async function resolveCustomFieldDisplaysForMany(db, items) {
  /** @type {Record<string, string>[]} */
  const results = items.map(() => ({}));
  /** @type {{ itemIndex: number, slot: string, id: string }[]} */
  const users = [];
  /** @type {{ itemIndex: number, slot: string, id: number }[]} */
  const contacts = [];
  /** @type {{ itemIndex: number, slot: string, id: number }[]} */
  const addresses = [];
  /** @type {{ itemIndex: number, slot: string, id: number }[]} */
  const tasks = [];

  for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
    const { customFields, customFieldDefs } = items[itemIndex];
    for (const def of customFieldDefs ?? []) {
      if (!def || def.dataType !== "lookup") continue;
      const slot = String(def.slot);
      const raw = customFields[slot];
      if (raw == null || raw === "") continue;
      if (isCustomFieldImportPlaceholder(raw)) continue;
      if (def.lookupTable === "users") {
        users.push({ itemIndex, slot, id: String(raw) });
      } else if (def.lookupTable === "contacts") {
        const id = Number(raw);
        if (Number.isInteger(id) && id > 0) contacts.push({ itemIndex, slot, id });
      } else if (def.lookupTable === "addresses") {
        const id = Number(raw);
        if (Number.isInteger(id) && id > 0) addresses.push({ itemIndex, slot, id });
      } else if (def.lookupTable === "tasks") {
        const id = Number(raw);
        if (Number.isInteger(id) && id > 0) tasks.push({ itemIndex, slot, id });
      }
    }
  }

  if (users.length > 0) {
    const ids = [...new Set(users.map((u) => u.id))];
    const { rows } = await db.query(
      `SELECT id::text AS id, display_name FROM users WHERE id = ANY($1::uuid[])`,
      [ids],
    );
    const names = new Map(rows.map((r) => [String(r.id), String(r.display_name ?? "")]));
    for (const item of users) {
      const name = names.get(item.id);
      if (name) results[item.itemIndex][item.slot] = name;
    }
  }

  if (contacts.length > 0) {
    const ids = [...new Set(contacts.map((c) => c.id))];
    const { rows } = await db.query(
      `SELECT id, name FROM contacts WHERE id = ANY($1::bigint[])`,
      [ids],
    );
    const names = new Map(rows.map((r) => [Number(r.id), String(r.name ?? "")]));
    for (const item of contacts) {
      const name = names.get(item.id);
      if (name) results[item.itemIndex][item.slot] = name;
    }
  }

  if (addresses.length > 0) {
    const ids = [...new Set(addresses.map((a) => a.id))];
    const { rows } = await db.query(
      `SELECT id, COALESCE(NULLIF(address_name, ''), street_line) AS name
       FROM addresses
       WHERE id = ANY($1::bigint[])`,
      [ids],
    );
    const names = new Map(rows.map((r) => [Number(r.id), String(r.name ?? "")]));
    for (const item of addresses) {
      const name = names.get(item.id);
      if (name) results[item.itemIndex][item.slot] = name;
    }
  }

  if (tasks.length > 0) {
    const ids = [...new Set(tasks.map((t) => t.id))];
    const { rows } = await db.query(
      `SELECT id, btrim(COALESCE(external_key, '')) AS name
       FROM tasks
       WHERE id = ANY($1::bigint[])`,
      [ids],
    );
    const names = new Map(rows.map((r) => [Number(r.id), String(r.name ?? "")]));
    for (const item of tasks) {
      const name = names.get(item.id);
      if (name) results[item.itemIndex][item.slot] = name;
    }
  }

  return results;
}

export async function resolveCustomFieldDisplays(db, values, defs) {
  /** @type {Record<string, string>} */
  const displays = {};
  /** @type {{ slot: string, id: string }[]} */
  const users = [];
  /** @type {{ slot: string, id: number }[]} */
  const contacts = [];
  /** @type {{ slot: string, id: number }[]} */
  const addresses = [];
  /** @type {{ slot: string, id: number }[]} */
  const tasks = [];

  for (const def of defs ?? []) {
    if (!def || def.dataType !== "lookup") continue;
    const slot = String(def.slot);
    const raw = values[slot];
    if (raw == null || raw === "") continue;
    if (isCustomFieldImportPlaceholder(raw)) continue;
    if (def.lookupTable === "users") {
      users.push({ slot, id: String(raw) });
    } else if (def.lookupTable === "contacts") {
      const id = Number(raw);
      if (Number.isInteger(id) && id > 0) contacts.push({ slot, id });
    } else if (def.lookupTable === "addresses") {
      const id = Number(raw);
      if (Number.isInteger(id) && id > 0) addresses.push({ slot, id });
    } else if (def.lookupTable === "tasks") {
      const id = Number(raw);
      if (Number.isInteger(id) && id > 0) tasks.push({ slot, id });
    }
  }

  if (users.length > 0) {
    const ids = [...new Set(users.map((u) => u.id))];
    const { rows } = await db.query(
      `SELECT id::text AS id, display_name FROM users WHERE id = ANY($1::uuid[])`,
      [ids],
    );
    const names = new Map(rows.map((r) => [String(r.id), String(r.display_name ?? "")]));
    for (const item of users) {
      const name = names.get(item.id);
      if (name) displays[item.slot] = name;
    }
  }

  if (contacts.length > 0) {
    const ids = [...new Set(contacts.map((c) => c.id))];
    const { rows } = await db.query(
      `SELECT id, name FROM contacts WHERE id = ANY($1::bigint[])`,
      [ids],
    );
    const names = new Map(rows.map((r) => [Number(r.id), String(r.name ?? "")]));
    for (const item of contacts) {
      const name = names.get(item.id);
      if (name) displays[item.slot] = name;
    }
  }

  if (addresses.length > 0) {
    const ids = [...new Set(addresses.map((a) => a.id))];
    const { rows } = await db.query(
      `SELECT id, COALESCE(NULLIF(address_name, ''), street_line) AS name
       FROM addresses
       WHERE id = ANY($1::bigint[])`,
      [ids],
    );
    const names = new Map(rows.map((r) => [Number(r.id), String(r.name ?? "")]));
    for (const item of addresses) {
      const name = names.get(item.id);
      if (name) displays[item.slot] = name;
    }
  }

  if (tasks.length > 0) {
    const ids = [...new Set(tasks.map((t) => t.id))];
    const { rows } = await db.query(
      `SELECT id, btrim(COALESCE(external_key, '')) AS name
       FROM tasks
       WHERE id = ANY($1::bigint[])`,
      [ids],
    );
    const names = new Map(rows.map((r) => [Number(r.id), String(r.name ?? "")]));
    for (const item of tasks) {
      const name = names.get(item.id);
      if (name) displays[item.slot] = name;
    }
  }

  return displays;
}
