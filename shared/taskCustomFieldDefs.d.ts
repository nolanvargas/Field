import type { CustomFieldShowWhen } from './customFieldShowWhen.js';

export type TaskCustomFieldDataType =
	| 'text'
	| 'number'
	| 'boolean'
	| 'date'
	| 'lookup'
	| 'select'
	| 'multiselect';

export interface TaskCustomFieldDef {
	slot: number;
	label: string;
	dataType: TaskCustomFieldDataType;
	required: boolean;
	lookupTable: string | null;
	options?: string[] | undefined;
	showWhen?: CustomFieldShowWhen | null;
}

export interface ResolvedTaskCustomFieldDef extends TaskCustomFieldDef {
	source: 'live' | 'snapshot';
	deleted: boolean;
	dataTypeDrift: boolean;
	snapshotDataType: TaskCustomFieldDataType | null;
}

export function normalizeTaskCustomFieldDef(
	def: unknown,
): TaskCustomFieldDef | null;

export function hasCustomFieldStoredValue(value: unknown): boolean;

export function taskHasCustomFieldValue(
	customFields: Record<string, unknown> | null | undefined,
	slot: number,
): boolean;

export function resolveTaskCustomFieldDefs(input: {
	liveDefs: TaskCustomFieldDef[];
	snapshotDefs: TaskCustomFieldDef[];
	customFields?: Record<string, unknown> | null;
	taskTypeName?: unknown;
	mode: 'display' | 'edit';
}): ResolvedTaskCustomFieldDef[];

export function displayDefForResolved(
	resolved: ResolvedTaskCustomFieldDef,
): TaskCustomFieldDef;

export function snapshotEntryFromDef(def: TaskCustomFieldDef): TaskCustomFieldDef;

export function applyTaskCustomFieldsUpdate(input: {
	liveDefs: TaskCustomFieldDef[];
	snapshotDefs: TaskCustomFieldDef[];
	storedCustomFields: Record<string, unknown>;
	incomingCustomFields?: Record<string, unknown> | null;
	touchedSlots?: number[];
	clearedSlots?: number[];
	taskTypeName?: unknown;
	parseSlot: (
		slot: number,
		raw: unknown,
		def: TaskCustomFieldDef,
	) => unknown;
}): {
	customFields: Record<string, unknown>;
	snapshotDefs: TaskCustomFieldDef[];
};
