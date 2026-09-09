import type { ReactNode } from 'react';
import type { OrgCustomFieldDef } from '../api/orgSettings';
import type { CustomFieldValue } from '../types/task';
import {
	CUSTOM_FIELD_UNDEFINED_DISPLAY,
	formatCustomFieldValue,
	isCustomFieldUndefined,
	labeledCustomFieldDefs,
	type WithCustomFields,
} from '../customFields';
import { RelativeTime } from './RelativeTime';

/**
 * Read-only value for one custom field. A required field a bulk import left
 * blank shows a dimmed "undefined" rather than the stored sentinel.
 */
export function customFieldValueNode(
	def: OrgCustomFieldDef,
	value: CustomFieldValue | undefined,
	display?: string | null,
): ReactNode {
	if (isCustomFieldUndefined(value)) {
		return (
			<span className='field-custom-field-undefined'>
				{CUSTOM_FIELD_UNDEFINED_DISPLAY}
			</span>
		);
	}
	if (def.dataType === 'date' && typeof value === 'string') {
		const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
		if (m) {
			return (
				<RelativeTime
					value={`${m[1]}-${m[2]}-${m[3]}T12:00:00`}
					variant='absolute'
				/>
			);
		}
	}
	return formatCustomFieldValue(def, value, display);
}

/**
 * Renders one detail row per labeled def using the caller's row component, so
 * each surface keeps its own markup.
 */
export function customFieldDetailRows(
	defs: OrgCustomFieldDef[],
	record: Partial<WithCustomFields> | null | undefined,
	renderRow: (args: {
		key: number;
		label: string;
		value: ReactNode;
	}) => ReactNode,
): ReactNode[] {
	return labeledCustomFieldDefs(defs).map((def) => {
		const slot = String(def.slot);
		return renderRow({
			key: def.slot,
			label: def.label,
			value: customFieldValueNode(
				def,
				record?.customFields?.[slot],
				record?.customFieldDisplays?.[slot],
			),
		});
	});
}
