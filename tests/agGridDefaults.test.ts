import { describe, expect, it } from 'vitest';
import {
	customFieldColumnId,
	getTaskColumnDefs,
	getTaskColumnOptions,
	parseCustomFieldColumnId,
	sanitizeVisibleTaskColumns,
} from '../src/agGridDefaults';

describe('task grid custom field columns', () => {
	it('builds column options from org custom field defs', () => {
		const options = getTaskColumnOptions('Job #', [
			{
				slot: 2,
				label: 'Lift gate',
				dataType: 'boolean',
				required: false,
				lookupTable: null,
				options: [],
			},
		]);
		expect(options.some((o) => o.field === 'cf:2' && o.headerName === 'Lift gate')).toBe(
			true,
		);
	});

	it('includes hidden custom field column defs when selected', () => {
		const defs = getTaskColumnDefs(['externalKey', customFieldColumnId(1)], {
			customFieldDefs: [
				{
					slot: 1,
					label: 'PO number',
					dataType: 'text',
					required: false,
					lookupTable: null,
					options: [],
				},
			],
		});
		const customCol = defs.find((col) => col.colId === 'cf:1');
		expect(customCol?.hide).toBe(false);
		expect(customCol?.headerName).toBe('PO number');
	});

	it('parses and sanitizes stored custom field column ids', () => {
		expect(parseCustomFieldColumnId('cf:3')).toBe(3);
		expect(parseCustomFieldColumnId('externalKey')).toBeNull();
		const sanitized = sanitizeVisibleTaskColumns(
			['externalKey', 'cf:1', 'cf:9'],
			[
				{
					slot: 1,
					label: 'PO',
					dataType: 'text',
					required: false,
					lookupTable: null,
					options: [],
				},
			],
		);
		expect(sanitized).toEqual(['externalKey', 'cf:1']);
	});
});
