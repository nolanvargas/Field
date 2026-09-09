/**
 * Custom fields for master-data records (users, contacts, addresses).
 *
 * Unlike tasks, these records do not freeze their definitions: every read and
 * write validates against the current org defs.
 */

import { getOrgSettings } from "./orgSettings.mjs";
import {
  assertLookupValues,
  normalizeStoredCustomFields,
  parseCustomFields,
  resolveCustomFieldDisplays,
  resolveCustomFieldDisplaysForMany,
} from "./customFields.mjs";
import { assertCustomFieldEntity } from "../shared/customFieldEntities.js";

/**
 * Defs with a label, sorted by slot. Unlabeled slots are drafts in Management.
 * @param {string} entity
 * @returns {Promise<import("./customFields.mjs").CustomFieldDef[]>}
 */
export async function entityCustomFieldDefs(entity) {
  assertCustomFieldEntity(entity);
  const org = await getOrgSettings();
  return (org.customFieldDefs[entity] ?? [])
    .filter((def) => String(def.label ?? "").trim().length > 0)
    .sort((a, b) => a.slot - b.slot);
}

/**
 * Validate a create/update payload for one entity. Returns undefined when the
 * caller omitted `customFields` entirely so partial updates leave values alone.
 *
 * @param {{ query: (sql: string, params?: unknown[]) => Promise<{ rowCount: number | null, rows: unknown[] }> }} db
 * @param {string} entity
 * @param {Record<string, unknown> | null | undefined} body
 * @param {{ placeholderForRequired?: boolean, requireAll?: boolean }} [opts]
 * @returns {Promise<Record<string, unknown> | undefined>}
 */
export async function parseEntityCustomFields(db, entity, body, opts = {}) {
  const payload = body && typeof body === "object" ? body : {};
  const provided = Object.prototype.hasOwnProperty.call(
    payload,
    "customFields",
  );
  if (!provided && !opts.requireAll) return undefined;

  const defs = await entityCustomFieldDefs(entity);
  if (defs.length === 0) return {};

  const values = parseCustomFields(
    provided ? payload.customFields : {},
    defs,
    { placeholderForRequired: opts.placeholderForRequired === true },
  );
  await assertLookupValues(db, values, defs);
  return values;
}

/**
 * Attach `customFields` + `customFieldDisplays` to a single mapped record.
 * @template {Record<string, unknown>} T
 * @param {{ query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> }} db
 * @param {string} entity
 * @param {T} mapped
 * @param {unknown} rawCustomFields
 * @returns {Promise<T & { customFields: Record<string, unknown>, customFieldDisplays: Record<string, string> }>}
 */
export async function withEntityCustomFields(db, entity, mapped, rawCustomFields) {
  const defs = await entityCustomFieldDefs(entity);
  const customFields = normalizeStoredCustomFields(rawCustomFields);
  const customFieldDisplays =
    defs.length > 0
      ? await resolveCustomFieldDisplays(db, customFields, defs)
      : {};
  return { ...mapped, customFields, customFieldDisplays };
}

/**
 * List variant: one batched lookup query per catalog table.
 * @template {Record<string, unknown>} T
 * @param {{ query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> }} db
 * @param {string} entity
 * @param {T[]} mapped
 * @param {unknown[]} rawCustomFields
 * @returns {Promise<Array<T & { customFields: Record<string, unknown>, customFieldDisplays: Record<string, string> }>>}
 */
export async function withEntityCustomFieldsForMany(
  db,
  entity,
  mapped,
  rawCustomFields,
) {
  const defs = await entityCustomFieldDefs(entity);
  const valueList = mapped.map((_, i) =>
    normalizeStoredCustomFields(rawCustomFields[i]),
  );
  const displays =
    defs.length > 0
      ? await resolveCustomFieldDisplaysForMany(
          db,
          valueList.map((customFields) => ({
            customFields,
            customFieldDefs: defs,
          })),
        )
      : mapped.map(() => ({}));
  return mapped.map((row, i) => ({
    ...row,
    customFields: valueList[i],
    customFieldDisplays: displays[i] ?? {},
  }));
}
