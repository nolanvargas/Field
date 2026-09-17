/** @vitest-environment node */
import { describe, expect, it } from 'vitest';
import {
	COMMON_TASK_TYPES,
	commonTaskTypeByName,
	unusedCommonTaskTypes,
} from '../shared/commonTaskTypes.js';

describe('COMMON_TASK_TYPES', () => {
	it('has unique names', () => {
		const names = COMMON_TASK_TYPES.map((t) => t.name);
		expect(new Set(names).size).toBe(names.length);
	});

	it('includes icon and plural for each entry', () => {
		for (const entry of COMMON_TASK_TYPES) {
			expect(entry.name.length).toBeGreaterThan(0);
			expect(entry.pluralName.length).toBeGreaterThan(0);
			expect(entry.icon.length).toBeGreaterThan(0);
		}
	});

	it('includes catalog defaults so they reappear after removal', () => {
		const names = COMMON_TASK_TYPES.map((t) => t.name);
		expect(names).toEqual(
			expect.arrayContaining([
				'Delivery',
				'Install',
				'Removal',
				'Site Survey',
				'Pickup',
				'Other',
			]),
		);
	});
});

describe('commonTaskTypeByName', () => {
	it('looks up by exact name case-insensitively', () => {
		expect(commonTaskTypeByName('delivery')).toEqual({
			name: 'Delivery',
			pluralName: 'Deliveries',
			icon: 'Truck',
		});
		expect(commonTaskTypeByName('inspection')).toEqual({
			name: 'Inspection',
			pluralName: 'Inspections',
			icon: 'ClipboardCheck',
		});
		expect(commonTaskTypeByName('  REPAIR ')).toEqual({
			name: 'Repair',
			pluralName: 'Repairs',
			icon: 'Wrench',
		});
	});

	it('returns undefined for unknown names', () => {
		expect(commonTaskTypeByName('NotARealType')).toBeUndefined();
		expect(commonTaskTypeByName('')).toBeUndefined();
	});
});

describe('unusedCommonTaskTypes', () => {
	it('includes Delivery when it is not on the org', () => {
		expect(unusedCommonTaskTypes([]).map((t) => t.name)).toContain('Delivery');
	});

	it('omits types already on the org', () => {
		const names = unusedCommonTaskTypes(['Delivery', 'Install']).map(
			(t) => t.name,
		);
		expect(names).not.toContain('Delivery');
		expect(names).not.toContain('Install');
		expect(names).toContain('Pickup');
	});
});
