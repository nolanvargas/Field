/**
 * Merge live org task custom field defs with per-task TCFS (snapshot).
 */

import { isCustomFieldImportPlaceholder } from './customFieldPlaceholders.js';
import { isCustomFieldVisible, normalizeShowWhen } from './customFieldShowWhen.js';

/**
 * @typedef {{
 *   slot: number,
 *   label: string,
 *   dataType: string,
 *   required: boolean,
 *   lookupTable: string | null,
 *   options?: string[],
 *   showWhen?: { taskTypeNames: string[] } | null,
 * }} TaskCustomFieldDef
 */

/**
 * @typedef {TaskCustomFieldDef & {
 *   source: 'live' | 'snapshot',
 *   deleted: boolean,
 *   dataTypeDrift: boolean,
 *   snapshotDataType: string | null,
 * }} ResolvedTaskCustomFieldDef
 */

/**
 * @param {unknown} raw
 * @returns {string[]}
 */
function normalizeOptions(raw) {
	if (!Array.isArray(raw)) return [];
	/** @type {string[]} */
	const out = [];
	const seen = new Set();
	for (const item of raw) {
		const s = String(item ?? '').trim();
		if (!s || seen.has(s)) continue;
		seen.add(s);
		out.push(s);
	}
	return out;
}

/**
 * @param {unknown} def
 * @returns {TaskCustomFieldDef | null}
 */
export function normalizeTaskCustomFieldDef(def) {
	if (!def || typeof def !== 'object') return null;
	const row = /** @type {Record<string, unknown>} */ (def);
	const slot = Number(row.slot);
	const label = String(row.label ?? '').trim();
	if (!Number.isInteger(slot) || slot < 1 || !label) return null;
	return {
		slot,
		label,
		dataType: String(row.dataType ?? 'text'),
		required: Boolean(row.required),
		lookupTable: row.lookupTable != null ? String(row.lookupTable) : null,
		options: normalizeOptions(row.options),
		showWhen: normalizeShowWhen(row.showWhen),
	};
}

/**
 * @param {TaskCustomFieldDef[]} defs
 * @returns {Map<number, TaskCustomFieldDef>}
 */
function defsBySlot(defs) {
	/** @type {Map<number, TaskCustomFieldDef>} */
	const map = new Map();
	for (const def of defs ?? []) {
		const normalized = normalizeTaskCustomFieldDef(def);
		if (normalized) map.set(normalized.slot, normalized);
	}
	return map;
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function hasCustomFieldStoredValue(value) {
	if (isCustomFieldImportPlaceholder(value)) return true;
	if (value == null || value === '') return false;
	if (Array.isArray(value)) return value.length > 0;
	return true;
}

/**
 * @param {Record<string, unknown> | null | undefined} customFields
 * @param {number} slot
 * @returns {boolean}
 */
export function taskHasCustomFieldValue(customFields, slot) {
	if (!customFields || typeof customFields !== 'object') return false;
	const key = String(slot);
	return hasCustomFieldStoredValue(customFields[key] ?? customFields[slot]);
}

/**
 * @param {TaskCustomFieldDef} live
 * @param {TaskCustomFieldDef | null} snapshot
 * @param {'display' | 'edit'} mode
 * @returns {ResolvedTaskCustomFieldDef}
 */
function resolveActiveSlot(live, snapshot, mode) {
	const dataTypeDrift =
		snapshot != null && String(snapshot.dataType) !== String(live.dataType);
	const snapshotDataType = snapshot ? String(snapshot.dataType) : null;
	let dataType = live.dataType;
	if (snapshot && mode === 'display') {
		dataType = snapshot.dataType;
	} else if (dataTypeDrift && mode === 'edit') {
		dataType = live.dataType;
	} else if (snapshot && !dataTypeDrift) {
		dataType = snapshot.dataType;
	}
	return {
		slot: live.slot,
		label: live.label,
		dataType,
		required: live.required,
		lookupTable: live.lookupTable,
		options: live.options ?? [],
		showWhen: live.showWhen ?? null,
		source: snapshot ? 'snapshot' : 'live',
		deleted: false,
		dataTypeDrift,
		snapshotDataType,
	};
}

/**
 * @param {{
 *   liveDefs: TaskCustomFieldDef[],
 *   snapshotDefs: TaskCustomFieldDef[],
 *   customFields?: Record<string, unknown> | null,
 *   taskTypeName?: unknown,
 *   mode: 'display' | 'edit',
 * }} input
 * @returns {ResolvedTaskCustomFieldDef[]}
 */
export function resolveTaskCustomFieldDefs(input) {
	const liveBySlot = defsBySlot(input.liveDefs);
	const snapshotBySlot = defsBySlot(input.snapshotDefs);
	const customFields = input.customFields ?? {};
	const mode = input.mode === 'edit' ? 'edit' : 'display';
	/** @type {ResolvedTaskCustomFieldDef[]} */
	const out = [];
	const seen = new Set();

	for (const live of [...liveBySlot.values()].sort((a, b) => a.slot - b.slot)) {
		if (!isCustomFieldVisible(live, input.taskTypeName)) continue;
		seen.add(live.slot);
		out.push(resolveActiveSlot(live, snapshotBySlot.get(live.slot) ?? null, mode));
	}

	for (const snapshot of [...snapshotBySlot.values()].sort(
		(a, b) => a.slot - b.slot,
	)) {
		if (seen.has(snapshot.slot) || liveBySlot.has(snapshot.slot)) continue;
		if (!taskHasCustomFieldValue(customFields, snapshot.slot)) continue;
		out.push({
			...snapshot,
			options: snapshot.options ?? [],
			showWhen: snapshot.showWhen ?? null,
			source: 'snapshot',
			deleted: true,
			dataTypeDrift: false,
			snapshotDataType: String(snapshot.dataType),
		});
	}

	return out;
}

/**
 * Def used to format a stored value (display mode / hints).
 * @param {ResolvedTaskCustomFieldDef} resolved
 * @returns {TaskCustomFieldDef}
 */
export function displayDefForResolved(resolved) {
	if (resolved.dataTypeDrift && resolved.snapshotDataType) {
		return { ...resolved, dataType: resolved.snapshotDataType };
	}
	return resolved;
}

/**
 * @param {TaskCustomFieldDef} def
 * @returns {TaskCustomFieldDef}
 */
export function snapshotEntryFromDef(def) {
	const normalized = normalizeTaskCustomFieldDef(def);
	if (!normalized) {
		throw new Error('Invalid custom field def for snapshot');
	}
	return {
		slot: normalized.slot,
		label: normalized.label,
		dataType: normalized.dataType,
		required: normalized.required,
		lookupTable: normalized.lookupTable,
		options: normalized.options ?? [],
		showWhen: normalized.showWhen ?? null,
	};
}

/**
 * Apply edit-mode custom field patch: merge stored values, touched slots, clears.
 *
 * @param {{
 *   liveDefs: TaskCustomFieldDef[],
 *   snapshotDefs: TaskCustomFieldDef[],
 *   storedCustomFields: Record<string, unknown>,
 *   incomingCustomFields?: Record<string, unknown> | null,
 *   touchedSlots?: number[],
 *   clearedSlots?: number[],
 *   taskTypeName?: unknown,
 *   parseSlot: (slot: number, raw: unknown, def: TaskCustomFieldDef) => unknown,
 * }} input
 * @returns {{ customFields: Record<string, unknown>, snapshotDefs: TaskCustomFieldDef[] }}
 */
export function applyTaskCustomFieldsUpdate(input) {
	const liveBySlot = defsBySlot(input.liveDefs);
	const snapshotBySlot = defsBySlot(input.snapshotDefs);
	const touched = new Set(
		(input.touchedSlots ?? []).map((s) => Number(s)).filter((s) => s >= 1),
	);
	const cleared = new Set(
		(input.clearedSlots ?? []).map((s) => Number(s)).filter((s) => s >= 1),
	);
	const incoming = input.incomingCustomFields ?? {};
	/** @type {Record<string, unknown>} */
	const customFields = { ...input.storedCustomFields };

	for (const slot of cleared) {
		const key = String(slot);
		delete customFields[key];
		snapshotBySlot.delete(slot);
	}

	for (const slot of touched) {
		if (cleared.has(slot)) continue;
		const live = liveBySlot.get(slot);
		if (!live || !isCustomFieldVisible(live, input.taskTypeName)) {
			throw Object.assign(
				new Error(`Custom field slot ${slot} is not editable`),
				{ status: 400 },
			);
		}
		const key = String(slot);
		const raw = incoming[key] !== undefined ? incoming[key] : incoming[slot];
		const parsed = input.parseSlot(slot, raw, live);
		if (parsed == null) {
			delete customFields[key];
		} else {
			customFields[key] = parsed;
		}
		snapshotBySlot.set(slot, snapshotEntryFromDef(live));
	}

	const snapshotDefs = [...snapshotBySlot.values()].sort(
		(a, b) => a.slot - b.slot,
	);
	return { customFields, snapshotDefs };
}
