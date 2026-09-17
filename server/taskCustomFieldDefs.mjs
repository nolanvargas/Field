import {
	applyTaskCustomFieldsUpdate,
	displayDefForResolved,
	resolveTaskCustomFieldDefs,
} from "../shared/taskCustomFieldDefs.js";
import { parseCustomFields } from "./customFields.mjs";
import { buildCustomFieldDefsSnapshot } from "./customFields.mjs";

/**
 * @param {import('../shared/taskCustomFieldDefs.js').TaskCustomFieldDef[]} liveDefs
 * @param {import('../shared/taskCustomFieldDefs.js').TaskCustomFieldDef[]} snapshotDefs
 * @param {Record<string, unknown>} customFields
 * @param {unknown} taskTypeName
 */
export function resolveTaskCustomFieldDefsForDisplay(
	liveDefs,
	snapshotDefs,
	customFields,
	taskTypeName,
) {
	return resolveTaskCustomFieldDefs({
		liveDefs,
		snapshotDefs,
		customFields,
		taskTypeName,
		mode: "display",
	});
}

/**
 * Display defs for lookup resolution (snapshot type when drifted).
 * @param {ReturnType<typeof resolveTaskCustomFieldDefs>} resolved
 */
export function displayDefsFromResolved(resolved) {
	return resolved.map((def) => displayDefForResolved(def));
}

/**
 * @param {unknown} raw
 * @returns {number[]}
 */
function asSlotList(raw) {
	if (!Array.isArray(raw)) return [];
	return [...new Set(raw.map((s) => Number(s)).filter((s) => s >= 1))];
}

/**
 * @param {{
 *   liveDefs: import('../shared/taskCustomFieldDefs.js').TaskCustomFieldDef[],
 *   snapshotDefs: import('../shared/taskCustomFieldDefs.js').TaskCustomFieldDef[],
 *   storedCustomFields: Record<string, unknown>,
 *   body: Record<string, unknown>,
 *   taskTypeName: unknown,
 * }} input
 */
export function mergeTaskCustomFieldsOnUpdate(input) {
	const touchedSlots = asSlotList(input.body.touchedCustomFieldSlots);
	const clearedSlots = asSlotList(input.body.clearedCustomFieldSlots);
	const incoming =
		input.body.customFields != null &&
		typeof input.body.customFields === "object" &&
		!Array.isArray(input.body.customFields)
			? /** @type {Record<string, unknown>} */ (input.body.customFields)
			: {};

	const { customFields, snapshotDefs } = applyTaskCustomFieldsUpdate({
		liveDefs: input.liveDefs,
		snapshotDefs: input.snapshotDefs,
		storedCustomFields: input.storedCustomFields,
		incomingCustomFields: incoming,
		touchedSlots,
		clearedSlots,
		taskTypeName: input.taskTypeName,
		parseSlot: (_slot, raw, def) => {
			const parsed = parseCustomFields(
				{ [String(def.slot)]: raw },
				[def],
				{ taskTypeName: input.taskTypeName },
			);
			return parsed[String(def.slot)] ?? null;
		},
	});

	return {
		customFields,
		snapshotJson: buildCustomFieldDefsSnapshot(snapshotDefs),
	};
}

/**
 * Required check for merged edit values.
 * @param {Record<string, unknown>} customFields
 * @param {ReturnType<typeof resolveTaskCustomFieldDefs>} editDefs
 */
export function assertRequiredMergedTaskCustomFields(customFields, editDefs) {
	for (const def of editDefs) {
		if (def.deleted || !def.required) continue;
		const key = String(def.slot);
		const v = customFields[key];
		if (v == null || v === "") {
			throw Object.assign(new Error(`${def.label} is required`), {
				status: 400,
			});
		}
		if (def.dataType === "multiselect" && (!Array.isArray(v) || v.length === 0)) {
			throw Object.assign(new Error(`${def.label} is required`), {
				status: 400,
			});
		}
	}
}
