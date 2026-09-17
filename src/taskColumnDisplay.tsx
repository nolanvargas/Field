import type { ReactNode } from 'react';
import type { OrgCustomFieldDef } from './api/orgSettings';
import {
	isBuiltinTaskColumnField,
	parseCustomFieldColumnId,
	type TaskColumnField,
	type TaskColumnOption,
} from './agGridDefaults';
import { RelativeTime } from './components/RelativeTime';
import { TaskStatusBadge } from './components/TaskStatusBadge';
import {
	formatCustomFieldValue,
	isCustomFieldUndefined,
} from './customFields';
import { formatShortName } from './formatName';
import { htmlToPlainText, isEmptyTaskDesc } from './taskDescHtml';
import type { Task } from './types/task';

function dash(value: string | null | undefined): string {
	const trimmed = (value ?? '').trim();
	return trimmed || '—';
}

function isBlank(value: string | null | undefined): boolean {
	return !(value ?? '').trim();
}

function customFieldDateTimeValue(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
	if (!m) return null;
	return `${m[1]}-${m[2]}-${m[3]}T12:00:00`;
}

function resolveCustomFieldDef(
	task: Task,
	slot: number,
	fallbackDefs: OrgCustomFieldDef[],
): OrgCustomFieldDef | undefined {
	return (
		task.customFieldDefs?.find((d) => d.slot === slot) ??
		fallbackDefs.find((d) => d.slot === slot)
	);
}

/** Builtins rendered in fixed packed slots on mobile cards (not labeled rows). */
const MOBILE_CARD_PACKED_BUILTIN_FIELDS = new Set<TaskColumnField>([
	'jobTitle',
	'destinationAddress',
	'windowStartAt',
	'windowEndAt',
	'createdByName',
	'crewName',
	'description',
]);

/** Builtins in the mobile card header (not labeled rows). */
const MOBILE_CARD_HEADER_BUILTIN_FIELDS = new Set<TaskColumnField>([
	'externalKey',
	'taskType',
]);

/** Extras on mobile cards: contacts + custom fields in catalog order. */
export function labeledMobileTaskCardFields(
	visibleFields: readonly TaskColumnField[],
	columnOptions: readonly TaskColumnOption[],
): TaskColumnField[] {
	return orderedVisibleTaskCardFields(visibleFields, columnOptions).filter(
		(field) => {
			if (MOBILE_CARD_PACKED_BUILTIN_FIELDS.has(field)) return false;
			if (MOBILE_CARD_HEADER_BUILTIN_FIELDS.has(field)) return false;
			if (field === 'status') return false;
			return true;
		},
	);
}

export function taskCardShowsCombinedWindowRow(
	visibleFields: readonly TaskColumnField[],
): boolean {
	return (
		visibleFields.includes('windowStartAt') &&
		visibleFields.includes('windowEndAt')
	);
}

export function taskCardShowsWindowRow(
	task: Task,
	visibleFields: readonly TaskColumnField[],
): boolean {
	if (!taskCardShowsCombinedWindowRow(visibleFields)) return false;
	return !(
		isBlank(task.windowStartAt) && isBlank(task.windowEndAt)
	);
}

export function taskCardHeaderLabel(
	task: Task,
	visibleFields: readonly TaskColumnField[],
): string | null {
	const showType = visibleFields.includes('taskType');
	const showKey = visibleFields.includes('externalKey');
	const type = task.taskType?.trim() || '';
	const key = task.externalKey?.trim() || '';
	if (showType && showKey && type && key) return `${type} - ${key}`;
	if (showType && type) return type;
	if (showKey && key) return key;
	if (showType || showKey) return type || key || null;
	return null;
}

/** True when a visible mobile card row would only show an em dash placeholder. */
export function isTaskColumnValueEmpty(
	task: Task,
	field: TaskColumnField,
	opts: {
		customFieldDefs?: OrgCustomFieldDef[];
	},
): boolean {
	const customFieldDefs = opts.customFieldDefs ?? [];
	const slot = parseCustomFieldColumnId(field);
	if (slot != null) {
		const def = resolveCustomFieldDef(task, slot, customFieldDefs);
		if (!def) return true;
		const raw = task.customFields?.[String(slot)];
		if (isCustomFieldUndefined(raw)) return true;
		if (def.dataType === 'date') {
			return !customFieldDateTimeValue(raw);
		}
		return isBlank(
			formatCustomFieldValue(
				def,
				raw,
				task.customFieldDisplays?.[String(slot)],
			),
		);
	}

	if (!isBuiltinTaskColumnField(field)) return true;

	switch (field) {
		case 'externalKey':
			return isBlank(task.externalKey);
		case 'jobTitle':
			return isBlank(task.jobTitle);
		case 'taskType':
			return isBlank(task.taskType);
		case 'destinationAddress':
			return isBlank(task.destinationAddress);
		case 'windowStartAt':
			return isBlank(task.windowStartAt);
		case 'windowEndAt':
			return isBlank(task.windowEndAt);
		case 'status':
			return false;
		case 'contactNames':
			return isBlank(task.contactNames);
		case 'crewName':
			return isBlank(task.crewName);
		case 'description':
			return isEmptyTaskDesc(task.description);
		case 'createdByName':
			return isBlank(task.createdByName);
		default:
			return true;
	}
}

export function taskCardShowsHeader(
	visibleFields: readonly TaskColumnField[],
): boolean {
	return (
		visibleFields.includes('taskType') ||
		visibleFields.includes('externalKey')
	);
}

/** Visible card/grid fields in catalog order (builtins then custom). */
export function orderedVisibleTaskCardFields(
	visibleFields: readonly TaskColumnField[],
	columnOptions: readonly TaskColumnOption[],
): TaskColumnField[] {
	const visible = new Set(visibleFields);
	return columnOptions
		.map((o) => o.field)
		.filter((field) => visible.has(field));
}

export function taskColumnHeaderName(
	field: TaskColumnField,
	columnOptions: readonly TaskColumnOption[],
): string {
	return columnOptions.find((o) => o.field === field)?.headerName ?? field;
}

export function renderTaskColumnValue(
	task: Task,
	field: TaskColumnField,
	opts: {
		customFieldDefs?: OrgCustomFieldDef[];
	},
): ReactNode {
	const customFieldDefs = opts.customFieldDefs ?? [];
	const slot = parseCustomFieldColumnId(field);
	if (slot != null) {
		const def = resolveCustomFieldDef(task, slot, customFieldDefs);
		if (!def) return '—';
		const raw = task.customFields?.[String(slot)];
		if (isCustomFieldUndefined(raw)) return '—';
		if (def.dataType === 'date') {
			const dateTime = customFieldDateTimeValue(raw);
			if (!dateTime) return '—';
			return (
				<RelativeTime value={dateTime} variant='absolute' />
			);
		}
		return dash(
			formatCustomFieldValue(
				def,
				raw,
				task.customFieldDisplays?.[String(slot)],
			),
		);
	}

	if (!isBuiltinTaskColumnField(field)) return '—';

	switch (field) {
		case 'externalKey':
			return dash(task.externalKey);
		case 'jobTitle':
			return dash(task.jobTitle);
		case 'taskType':
			return task.taskType || '—';
		case 'destinationAddress':
			return dash(task.destinationAddress);
		case 'windowStartAt':
			return (
				<RelativeTime value={task.windowStartAt} variant='ago' />
			);
		case 'windowEndAt':
			return <RelativeTime value={task.windowEndAt} variant='ago' />;
		case 'status':
			return <TaskStatusBadge status={task.status} />;
		case 'contactNames':
			return dash(task.contactNames);
		case 'crewName':
			return dash(task.crewName);
		case 'description':
			return dash(htmlToPlainText(task.description ?? ''));
		case 'createdByName': {
			const name = task.createdByName?.trim();
			if (!name) return '—';
			return formatShortName(name);
		}
		default:
			return '—';
	}
}

export function taskDescriptionPlainText(task: Task): string {
	return htmlToPlainText(task.description ?? '');
}

export function taskShowsDescriptionBlock(
	task: Task,
	visibleFields: readonly TaskColumnField[],
): boolean {
	return (
		visibleFields.includes('description') &&
		!isEmptyTaskDesc(task.description)
	);
}
