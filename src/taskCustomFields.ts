import type { OrgCustomFieldDef } from './api/orgSettings';
import type { CustomFieldValue } from './types/task';
import {
	displayDefForResolved,
	resolveTaskCustomFieldDefs,
	type ResolvedTaskCustomFieldDef,
} from '../shared/taskCustomFieldDefs.js';
import {
	formatCustomFieldValue,
	isCustomFieldUndefined,
	requiredCustomFieldError,
} from './customFields';

export type { ResolvedTaskCustomFieldDef };

export function resolveEditTaskCustomFieldDefs(
	liveDefs: OrgCustomFieldDef[],
	snapshotDefs: OrgCustomFieldDef[],
	customFields: Record<string, CustomFieldValue>,
	taskTypeName: string,
): ResolvedTaskCustomFieldDef[] {
	return resolveTaskCustomFieldDefs({
		liveDefs,
		snapshotDefs,
		customFields,
		taskTypeName,
		mode: 'edit',
	});
}

export function resolveDisplayTaskCustomFieldDefs(
	liveDefs: OrgCustomFieldDef[],
	snapshotDefs: OrgCustomFieldDef[],
	customFields: Record<string, CustomFieldValue>,
	taskTypeName: string,
): ResolvedTaskCustomFieldDef[] {
	return resolveTaskCustomFieldDefs({
		liveDefs,
		snapshotDefs,
		customFields,
		taskTypeName,
		mode: 'display',
	});
}

export function customFieldDriftHint(
	def: ResolvedTaskCustomFieldDef,
	storedValue: CustomFieldValue | undefined,
	displayValue?: string | null,
): string | null {
	if (!def.dataTypeDrift) return null;
	const displayDef = displayDefForResolved(def);
	const formatted = formatCustomFieldValue(
		displayDef,
		storedValue,
		displayValue,
	);
	if (!formatted && !isCustomFieldUndefined(storedValue)) return null;
	if (!formatted) return null;
	return formatted;
}

export function taskDisplayCustomFieldDefs(
	task: {
		customFieldDefs?: OrgCustomFieldDef[];
		customFieldDefsSnapshot?: OrgCustomFieldDef[];
		customFields?: Record<string, CustomFieldValue>;
		taskType: string;
	},
	liveDefs: OrgCustomFieldDef[],
): OrgCustomFieldDef[] {
	if (task.customFieldDefs && task.customFieldDefs.length > 0) {
		return task.customFieldDefs;
	}
	return resolveDisplayTaskCustomFieldDefs(
		liveDefs,
		task.customFieldDefsSnapshot ?? [],
		task.customFields ?? {},
		task.taskType,
	);
}

export function requiredMergedTaskCustomFieldError(
	formValues: Record<string, CustomFieldValue>,
	storedValues: Record<string, CustomFieldValue>,
	touchedSlots: ReadonlySet<number>,
	defs: ResolvedTaskCustomFieldDef[],
	taskTypeName: string,
): string | null {
	const effective: Record<string, CustomFieldValue> = {};
	for (const def of defs) {
		if (def.deleted) continue;
		const key = String(def.slot);
		if (def.dataTypeDrift && !touchedSlots.has(def.slot)) {
			if (storedValues[key] !== undefined) {
				effective[key] = storedValues[key];
			}
		} else if (formValues[key] !== undefined) {
			effective[key] = formValues[key];
		} else if (!def.dataTypeDrift && storedValues[key] !== undefined) {
			effective[key] = storedValues[key];
		}
	}
	return requiredCustomFieldError(effective, defs, taskTypeName);
}
