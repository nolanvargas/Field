import type { OrgCustomFieldDef } from './api/orgSettings';
import type { CustomFieldValue } from './types/task';
import {
	CUSTOM_FIELD_UNDEFINED_DISPLAY,
	isCustomFieldImportPlaceholder,
} from '../shared/customFieldPlaceholders.js';
import { isCustomFieldVisible } from '../shared/customFieldShowWhen.js';

/** Shape returned by any API record that carries org custom fields. */
export interface WithCustomFields {
	customFields: Record<string, CustomFieldValue>;
	customFieldDisplays: Record<string, string>;
}

export type CustomFieldValues = Record<string, CustomFieldValue>;

/** Trim, drop blanks, dedupe (case-sensitive, first wins). */
export function normalizeCustomFieldOptions(raw: string[]): string[] {
	const out: string[] = [];
	const seen = new Set<string>();
	for (const item of raw) {
		const s = String(item ?? '').trim();
		if (!s || seen.has(s)) continue;
		seen.add(s);
		out.push(s);
	}
	return out;
}

export function formatCustomFieldOptionsSummary(options: string[]): string {
	const count = options.length;
	if (count === 0) return '0 options';
	const noun = count === 1 ? 'option' : 'options';
	if (count <= 2) {
		return `${count} ${noun} — ${options.join(', ')}`;
	}
	return `${count} ${noun}`;
}

export function labeledCustomFieldDefs(
	defs: OrgCustomFieldDef[],
): OrgCustomFieldDef[] {
	return defs
		.filter((d) => d.label.trim().length > 0)
		.sort((a, b) => a.slot - b.slot);
}

export function visibleLabeledCustomFieldDefs(
	defs: OrgCustomFieldDef[],
	taskTypeName: unknown,
): OrgCustomFieldDef[] {
	return labeledCustomFieldDefs(defs).filter((d) =>
		isCustomFieldVisible(d, taskTypeName),
	);
}

/**
 * True when a bulk import left a required field blank. The stored sentinel is
 * never shown: callers render {@link CUSTOM_FIELD_UNDEFINED_DISPLAY} dimmed.
 */
export function isCustomFieldUndefined(
	value: CustomFieldValue | undefined,
): boolean {
	return isCustomFieldImportPlaceholder(value);
}

export { CUSTOM_FIELD_UNDEFINED_DISPLAY };

export function formatCustomFieldValue(
	def: OrgCustomFieldDef,
	value: CustomFieldValue | undefined,
	displayValue?: string | null,
): string {
	if (isCustomFieldUndefined(value)) return CUSTOM_FIELD_UNDEFINED_DISPLAY;
	if (displayValue) return displayValue;
	if (value == null || value === '') return '';
	if (def.dataType === 'boolean') return value ? 'Yes' : 'No';
	if (def.dataType === 'multiselect' && Array.isArray(value)) {
		return value.length > 0 ? value.join(' · ') : '';
	}
	if (def.dataType === 'select' && typeof value === 'string') {
		return value;
	}
	if (def.dataType === 'date' && typeof value === 'string') {
		const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
		if (m) {
			const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
			if (!Number.isNaN(d.getTime())) {
				return d.toLocaleDateString(undefined, {
					year: 'numeric',
					month: 'short',
					day: 'numeric',
				});
			}
		}
	}
	return String(value);
}

export function requiredCustomFieldError(
	values: Record<string, CustomFieldValue>,
	defs: OrgCustomFieldDef[],
	taskTypeName?: unknown,
): string | null {
	for (const def of labeledCustomFieldDefs(defs)) {
		if (!isCustomFieldVisible(def, taskTypeName)) continue;
		if (!def.required) continue;
		const v = values[String(def.slot)];
		// An import placeholder is not a filled value.
		if (isCustomFieldUndefined(v)) return `${def.label} is required`;
		if (def.dataType === 'boolean') {
			if (v == null) return `${def.label} is required`;
			continue;
		}
		if (def.dataType === 'multiselect') {
			if (!Array.isArray(v) || v.length === 0) return `${def.label} is required`;
			continue;
		}
		if (v == null || v === '') return `${def.label} is required`;
	}
	return null;
}
