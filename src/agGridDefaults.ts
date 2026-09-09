import { createElement, useCallback, useRef } from 'react';
import type {
	ColDef,
	FilterModel,
	GridApi,
	GridReadyEvent,
	ICellRendererParams,
	ValueFormatterParams,
} from 'ag-grid-community';
import type { Address } from './api/addresses';
import type { Contact } from './api/contacts';
import type { OrgCustomFieldDef } from './api/orgSettings';
import { hasDestinationCoords } from '../shared/destinationCoords.js';
import { RelativeTime } from './components/RelativeTime';
import { TaskStatusBadge } from './components/TaskStatusBadge';
import type { CustomFieldValue, Task, TaskStatus } from './types/task';
import {
	formatCustomFieldValue,
	isCustomFieldUndefined,
	labeledCustomFieldDefs,
	type WithCustomFields,
} from './customFields';
import { formatShortName } from './formatName';
import { htmlToPlainText } from './taskDescHtml';
import { readPageState, writePageState } from './desktopPageState';

/**
 * Mobile breakpoint for AG Grid pages — matches AppShell `sm`
 * (`max-width` just under 48em).
 */
export const AG_GRID_MOBILE_MQ = '(max-width: 47.9975em)';

const sharedDefaultColDef: ColDef = {
	sortable: true,
	resizable: true,
};

/** Desktop: filters enabled for denser data exploration. */
export const desktopDefaultColDef: ColDef = {
	...sharedDefaultColDef,
	filter: true,
};

/** Mobile: filters off — awkward on small touch screens. */
export const mobileDefaultColDef: ColDef = {
	...sharedDefaultColDef,
	filter: false,
};

export function getDefaultColDef(isMobile: boolean | undefined): ColDef {
	return isMobile ? mobileDefaultColDef : desktopDefaultColDef;
}

const emptyDash = <T>(p: ValueFormatterParams<T, string | null>) => {
	const value = p.value ?? '';
	return value.trim() ? value : '—';
};

export type BuiltinTaskColumnField = keyof Pick<
	Task,
	| 'externalKey'
	| 'jobTitle'
	| 'taskType'
	| 'destinationAddress'
	| 'windowStartAt'
	| 'status'
	| 'contactNames'
	| 'crewName'
	| 'windowEndAt'
	| 'description'
	| 'createdByName'
>;

export type CustomFieldColumnField = `cf:${number}`;

export type TaskColumnField = BuiltinTaskColumnField | CustomFieldColumnField;

const CUSTOM_FIELD_COLUMN_PREFIX = 'cf:';

export function customFieldColumnId(slot: number): CustomFieldColumnField {
	return `cf:${slot}`;
}

export function parseCustomFieldColumnId(
	field: string,
): number | null {
	if (!field.startsWith(CUSTOM_FIELD_COLUMN_PREFIX)) return null;
	const slot = Number(field.slice(CUSTOM_FIELD_COLUMN_PREFIX.length));
	return Number.isInteger(slot) && slot >= 1 ? slot : null;
}

export function isBuiltinTaskColumnField(
	field: string,
): field is BuiltinTaskColumnField {
	return ALL_BUILTIN_TASK_COLUMN_FIELDS.has(field as BuiltinTaskColumnField);
}

export type TaskColumnOption = {
	field: TaskColumnField;
	headerName: string;
	required?: boolean;
};

export const REQUIRED_TASK_COLUMNS: BuiltinTaskColumnField[] = ['externalKey'];

export const TASK_COLUMN_OPTIONS: TaskColumnOption[] = [
	{ field: 'externalKey', headerName: 'Job', required: true },
	{ field: 'jobTitle', headerName: 'Title' },
	{ field: 'taskType', headerName: 'Type' },
	{ field: 'destinationAddress', headerName: 'Destination' },
	{ field: 'windowStartAt', headerName: 'Start' },
	{ field: 'status', headerName: 'Status' },
	{ field: 'contactNames', headerName: 'Contacts' },
	{ field: 'crewName', headerName: 'Crew' },
	{ field: 'windowEndAt', headerName: 'End' },
	{ field: 'description', headerName: 'Description' },
	{ field: 'createdByName', headerName: 'Created by' },
];

export const DEFAULT_VISIBLE_TASK_COLUMNS: BuiltinTaskColumnField[] = [
	'externalKey',
	'jobTitle',
	'taskType',
	'destinationAddress',
	'windowStartAt',
];

export const TASK_COLUMNS_STORAGE_KEY = 'field:taskGridColumns';

const ALL_BUILTIN_TASK_COLUMN_FIELDS = new Set(
	TASK_COLUMN_OPTIONS.map((o) => o.field),
);

function isStoredTaskColumnField(field: string): field is TaskColumnField {
	return (
		ALL_BUILTIN_TASK_COLUMN_FIELDS.has(field as BuiltinTaskColumnField) ||
		parseCustomFieldColumnId(field) != null
	);
}

function withRequiredColumns(fields: TaskColumnField[]): TaskColumnField[] {
	const next = new Set(fields);
	for (const required of REQUIRED_TASK_COLUMNS) {
		next.add(required);
	}
	const builtins = TASK_COLUMN_OPTIONS.map((o) => o.field).filter((f) =>
		next.has(f),
	);
	const custom = fields.filter(
		(f) => parseCustomFieldColumnId(f) != null && next.has(f),
	);
	return [...builtins, ...custom];
}

export function sanitizeVisibleTaskColumns(
	fields: TaskColumnField[],
	customFieldDefs: OrgCustomFieldDef[],
): TaskColumnField[] {
	const validSlots = new Set(
		labeledCustomFieldDefs(customFieldDefs).map((d) => d.slot),
	);
	return fields.filter((field) => {
		const slot = parseCustomFieldColumnId(field);
		if (slot != null) return validSlots.has(slot);
		return isBuiltinTaskColumnField(field);
	});
}

export function readVisibleTaskColumns(): TaskColumnField[] {
	try {
		const raw = localStorage.getItem(TASK_COLUMNS_STORAGE_KEY);
		if (!raw) return [...DEFAULT_VISIBLE_TASK_COLUMNS];
		const parsed: unknown = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [...DEFAULT_VISIBLE_TASK_COLUMNS];
		const fields = parsed.filter(
			(f): f is TaskColumnField =>
				typeof f === 'string' && isStoredTaskColumnField(f),
		);
		if (fields.length === 0) return [...DEFAULT_VISIBLE_TASK_COLUMNS];
		return withRequiredColumns(fields);
	} catch {
		return [...DEFAULT_VISIBLE_TASK_COLUMNS];
	}
}

export function writeVisibleTaskColumns(
	fields: TaskColumnField[],
): TaskColumnField[] {
	const next = withRequiredColumns(fields);
	try {
		localStorage.setItem(TASK_COLUMNS_STORAGE_KEY, JSON.stringify(next));
	} catch {
		/* private mode / blocked storage */
	}
	return next;
}

export function getTaskColumnOptions(
	externalKeyLabel = 'Job',
	customFieldDefs: OrgCustomFieldDef[] = [],
): TaskColumnOption[] {
	const builtins = TASK_COLUMN_OPTIONS.map((opt) =>
		opt.field === 'externalKey'
			? { ...opt, headerName: externalKeyLabel }
			: opt,
	);
	const custom = labeledCustomFieldDefs(customFieldDefs).map((def) => ({
		field: customFieldColumnId(def.slot),
		headerName: def.label,
	}));
	return [...builtins, ...custom];
}

function buildExternalKeyColumnDef(
	externalKeyLabel: string,
): ColDef<Task> {
	return {
		field: 'externalKey',
		headerName: externalKeyLabel,
		valueFormatter: (p: ValueFormatterParams<Task, string>) => {
			const trimmed = (p.value ?? '').trim();
			return trimmed || '—';
		},
		minWidth: 72,
		flex: 0.5,
		suppressSizeToFit: true,
	};
}

const taskColumnDefsBase: ColDef<Task>[] = [
	buildExternalKeyColumnDef('Job'),
	{
		field: 'jobTitle',
		headerName: 'Title',
		valueFormatter: emptyDash,
		minWidth: 140,
		flex: 1.4,
	},
	{
		field: 'taskType',
		headerName: 'Type',
		minWidth: 72,
		maxWidth: 100,
		flex: 0.5,
		valueFormatter: (p: ValueFormatterParams<Task, string>) => {
			const value = p.value ?? '';
			if (value === 'Site Survey') return 'SS';
			return value;
		},
	},
	{
		field: 'destinationAddress',
		headerName: 'Destination',
		minWidth: 120,
		flex: 1.2,
	},
	{
		field: 'windowStartAt',
		headerName: 'Start',
		cellRenderer: (params: ICellRendererParams<Task, string | null>) =>
			createElement(RelativeTime, {
				value: params.value ?? null,
				variant: 'ago',
			}),
		minWidth: 120,
		flex: 1.2,
	},
	{
		field: 'status',
		headerName: 'Status',
		minWidth: 110,
		flex: 0.8,
		cellRenderer: (params: ICellRendererParams<Task, TaskStatus>) => {
			const status = params.value;
			if (!status) return null;
			return createElement(TaskStatusBadge, { status });
		},
	},
	{
		field: 'contactNames',
		headerName: 'Contacts',
		valueFormatter: emptyDash,
		minWidth: 120,
		flex: 1.2,
	},
	{
		field: 'crewName',
		headerName: 'Crew',
		valueFormatter: emptyDash,
		minWidth: 100,
		flex: 1,
	},
	{
		field: 'windowEndAt',
		headerName: 'End',
		cellRenderer: (params: ICellRendererParams<Task, string | null>) =>
			createElement(RelativeTime, {
				value: params.value ?? null,
				variant: 'ago',
			}),
		minWidth: 120,
		flex: 1.2,
	},
	{
		field: 'description',
		headerName: 'Description',
		valueFormatter: (p: ValueFormatterParams<Task, string>) => {
			const plain = htmlToPlainText(p.value ?? '');
			return plain || '—';
		},
		minWidth: 140,
		flex: 1.4,
	},
	{
		field: 'createdByName',
		headerName: 'Created by',
		valueFormatter: (p: ValueFormatterParams<Task, string>) => {
			const name = p.value?.trim();
			if (!name) return '—';
			return formatShortName(name);
		},
		minWidth: 100,
		flex: 1,
	},
];

/** Cancelled tasks show TTL from per-task archiveAt (frozen at cancel). */
function buildCancelledTtlColumnDef(): ColDef<Task> {
	return {
		colId: 'ttl',
		headerName: 'TTL',
		valueGetter: (p) => p.data?.archiveAt ?? null,
		cellRenderer: (params: ICellRendererParams<Task, string | null>) =>
			createElement(RelativeTime, {
				value: params.value ?? null,
				variant: 'ago',
			}),
		minWidth: 100,
		flex: 0.8,
		sortable: true,
	};
}

/**
 * One grid column for a custom field. `resolveDef` lets tasks render historical
 * rows against their frozen snapshot; master-data grids always use live defs.
 *
 * Column ids stay `cf:{slot}` — slots are scoped per entity and each entity has
 * its own grid, so there is no collision to disambiguate.
 */
function customFieldDateTimeValue(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
	if (!m) return null;
	return `${m[1]}-${m[2]}-${m[3]}T12:00:00`;
}

function buildCustomFieldColumnDef<T extends Partial<WithCustomFields>>(
	def: OrgCustomFieldDef,
	resolveDef?: (row: T) => OrgCustomFieldDef,
): ColDef<T> {
	const slot = String(def.slot);
	const shared: ColDef<T> = {
		colId: customFieldColumnId(def.slot),
		headerName: def.label,
		cellClass: (p) =>
			isCustomFieldUndefined(p.data?.customFields?.[slot])
				? 'field-custom-field-undefined'
				: '',
		minWidth: 100,
		flex: 1,
	};

	if (def.dataType === 'date') {
		return {
			...shared,
			valueGetter: (p) => p.data?.customFields?.[slot] ?? '',
			cellRenderer: (params: ICellRendererParams<T, CustomFieldValue>) => {
				const raw = params.value;
				if (isCustomFieldUndefined(raw)) return '—';
				const dateTime = customFieldDateTimeValue(raw);
				if (!dateTime) return '—';
				return createElement(RelativeTime, {
					value: dateTime,
					variant: 'absolute',
				});
			},
		};
	}

	return {
		...shared,
		valueGetter: (p) => {
			const row = p.data;
			if (!row) return '';
			return formatCustomFieldValue(
				resolveDef?.(row) ?? def,
				row.customFields?.[slot],
				row.customFieldDisplays?.[slot],
			);
		},
		valueFormatter: (p: ValueFormatterParams<T, string>) => {
			const value = p.value ?? '';
			return value.trim() ? value : '—';
		},
	};
}

/** Custom field columns appended to a master-data grid (users, contacts, addresses). */
export function entityCustomFieldColumnDefs<T extends Partial<WithCustomFields>>(
	defs: OrgCustomFieldDef[],
): ColDef<T>[] {
	return labeledCustomFieldDefs(defs).map((def) =>
		buildCustomFieldColumnDef<T>(def),
	);
}

/** Full task column catalog (defaults visible until `getTaskColumnDefs` applies prefs). */
export const taskColumnDefs: ColDef<Task>[] = taskColumnDefsBase;

export function getTaskColumnDefs(
	visibleFields: readonly TaskColumnField[],
	opts?: {
		showCancelledTtl?: boolean;
		externalKeyLabel?: string;
		customFieldDefs?: OrgCustomFieldDef[];
	},
): ColDef<Task>[] {
	const visible = new Set(withRequiredColumns([...visibleFields]));
	const externalKeyLabel = opts?.externalKeyLabel ?? 'Job';
	const customDefs = labeledCustomFieldDefs(opts?.customFieldDefs ?? []);
	const baseCols = taskColumnDefsBase.map((col) => {
		if (col.field === 'externalKey') {
			return buildExternalKeyColumnDef(externalKeyLabel);
		}
		return col;
	});
	const cols = baseCols.map((col) => {
		const field = col.field as BuiltinTaskColumnField | undefined;
		if (!field) return col;
		return {
			...col,
			hide: !visible.has(field),
		};
	});
	for (const def of customDefs) {
		cols.push({
			...buildCustomFieldColumnDef<Task>(def, (task) =>
				task.customFieldDefs?.find((d) => d.slot === def.slot) ?? def,
			),
			hide: !visible.has(customFieldColumnId(def.slot)),
		});
	}
	if (opts?.showCancelledTtl) {
		cols.unshift(buildCancelledTtlColumnDef());
	}
	return cols;
}

export const addressColumnDefs: ColDef<Address>[] = [
	{
		field: 'addressName',
		headerName: 'Name',
		valueFormatter: emptyDash,
		minWidth: 100,
		flex: 1.2,
	},
	{
		field: 'streetLine',
		headerName: 'Street',
		minWidth: 120,
		flex: 1.4,
	},
	{
		field: 'building',
		headerName: 'Building',
		valueFormatter: emptyDash,
		minWidth: 80,
		flex: 0.8,
	},
	{
		field: 'notes',
		headerName: 'Notes',
		valueFormatter: emptyDash,
		minWidth: 100,
		flex: 1.2,
	},
	{
		colId: 'locationStatus',
		headerName: 'Location',
		minWidth: 88,
		flex: 0.7,
		valueGetter: (params) =>
			params.data && hasDestinationCoords(params.data) ? 'set' : 'missing',
		valueFormatter: (params) =>
			params.value === 'set' ? 'Set' : 'Missing',
	},
];

export const contactColumnDefs: ColDef<Contact>[] = [
	{
		field: 'name',
		headerName: 'Contact',
		minWidth: 100,
		flex: 1.2,
	},
	{
		field: 'title',
		headerName: 'Title',
		valueFormatter: emptyDash,
		minWidth: 100,
		flex: 1,
	},
	{
		field: 'phone',
		headerName: 'Phone',
		valueFormatter: emptyDash,
		minWidth: 88,
		flex: 0.8,
	},
	{
		field: 'email',
		headerName: 'Email',
		valueFormatter: emptyDash,
		minWidth: 100,
		flex: 1.2,
	},
];

export type GridSessionId =
	| 'addresses'
	| 'contacts'
	| 'users'
	| 'dev-tests'
	| 'dev-scripts';

export type GridSessionState = {
	columnState?: ReturnType<GridApi['getColumnState']>;
	filterModel?: FilterModel | null;
};

export function readGridSessionState(
	gridId: GridSessionId,
): GridSessionState | null {
	const saved = readPageState<GridSessionState | null>(`grid:${gridId}`, null);
	if (!saved || typeof saved !== 'object') return null;
	return saved;
}

export function writeGridSessionState(
	gridId: GridSessionId,
	state: GridSessionState,
): void {
	writePageState(`grid:${gridId}`, state);
}

function applyGridSessionState(api: GridApi, state: GridSessionState): void {
	if (state.columnState?.length) {
		api.applyColumnState({ state: state.columnState, applyOrder: true });
	}
	if (state.filterModel != null) {
		api.setFilterModel(state.filterModel);
	}
}

function saveGridSessionState(api: GridApi, gridId: GridSessionId): void {
	writeGridSessionState(gridId, {
		columnState: api.getColumnState(),
		filterModel: api.getFilterModel(),
	});
}

/** Desktop-only: restore AG Grid sort/filter from sessionStorage across page navigation. */
export function usePersistedAgGridSession(
	gridId: GridSessionId,
	enabled: boolean,
) {
	const appliedRef = useRef(false);

	const applySavedState = useCallback(
		(api: GridApi) => {
			if (!enabled || appliedRef.current) return;
			const saved = readGridSessionState(gridId);
			if (!saved) return;
			applyGridSessionState(api, saved);
			appliedRef.current = true;
		},
		[enabled, gridId],
	);

	const onGridReady = useCallback(
		(event: GridReadyEvent) => {
			applySavedState(event.api);
		},
		[applySavedState],
	);

	const onFirstDataRendered = useCallback(
		(event: { api: GridApi }) => {
			applySavedState(event.api);
			event.api.sizeColumnsToFit();
		},
		[applySavedState],
	);

	const onGridSizeChanged = useCallback((event: { api: GridApi }) => {
		event.api.sizeColumnsToFit();
	}, []);

	const onSortChanged = useCallback(
		(event: { api: GridApi }) => {
			if (!enabled) return;
			saveGridSessionState(event.api, gridId);
		},
		[enabled, gridId],
	);

	const onFilterChanged = useCallback(
		(event: { api: GridApi }) => {
			if (!enabled) return;
			saveGridSessionState(event.api, gridId);
		},
		[enabled, gridId],
	);

	return {
		onGridReady,
		onFirstDataRendered,
		onGridSizeChanged,
		onSortChanged,
		onFilterChanged,
	};
}
