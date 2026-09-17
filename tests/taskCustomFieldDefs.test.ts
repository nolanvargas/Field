/** @vitest-environment node */
import { describe, expect, it } from 'vitest';
import {
	applyTaskCustomFieldsUpdate,
	displayDefForResolved,
	hasCustomFieldStoredValue,
	resolveTaskCustomFieldDefs,
	taskHasCustomFieldValue,
} from '../shared/taskCustomFieldDefs.js';

const liveText = {
	slot: 1,
	label: 'Renamed label',
	dataType: 'text',
	required: false,
	lookupTable: null,
	options: [],
	showWhen: null,
};

const snapNumber = {
	slot: 1,
	label: 'Old label',
	dataType: 'number',
	required: false,
	lookupTable: null,
	options: [],
	showWhen: null,
};

const liveNew = {
	slot: 2,
	label: 'New field',
	dataType: 'text',
	required: false,
	lookupTable: null,
	options: [],
	showWhen: null,
};

const deletedSnap = {
	slot: 3,
	label: 'Gone',
	dataType: 'text',
	required: false,
	lookupTable: null,
	options: [],
	showWhen: null,
};

describe('resolveTaskCustomFieldDefs', () => {
	it('overlays live label on snapshot slot in display mode', () => {
		const resolved = resolveTaskCustomFieldDefs({
			liveDefs: [liveText],
			snapshotDefs: [snapNumber],
			customFields: { '1': 42 },
			taskTypeName: 'Delivery',
			mode: 'display',
		});
		expect(resolved).toHaveLength(1);
		expect(resolved[0].label).toBe('Renamed label');
		expect(resolved[0].dataType).toBe('number');
		expect(resolved[0].dataTypeDrift).toBe(true);
	});

	it('uses live dataType in edit mode when drifted', () => {
		const resolved = resolveTaskCustomFieldDefs({
			liveDefs: [liveText],
			snapshotDefs: [snapNumber],
			customFields: { '1': 42 },
			taskTypeName: 'Delivery',
			mode: 'edit',
		});
		expect(resolved[0].dataType).toBe('text');
		expect(resolved[0].dataTypeDrift).toBe(true);
		expect(resolved[0].snapshotDataType).toBe('number');
	});

	it('includes new live-only fields on edit', () => {
		const resolved = resolveTaskCustomFieldDefs({
			liveDefs: [liveNew],
			snapshotDefs: [],
			customFields: {},
			taskTypeName: 'Delivery',
			mode: 'edit',
		});
		expect(resolved).toHaveLength(1);
		expect(resolved[0].slot).toBe(2);
		expect(resolved[0].source).toBe('live');
	});

	it('includes deleted snapshot fields only when value exists', () => {
		const withValue = resolveTaskCustomFieldDefs({
			liveDefs: [],
			snapshotDefs: [deletedSnap],
			customFields: { '3': 'keep' },
			taskTypeName: 'Delivery',
			mode: 'edit',
		});
		expect(withValue).toHaveLength(1);
		expect(withValue[0].deleted).toBe(true);

		const withoutValue = resolveTaskCustomFieldDefs({
			liveDefs: [],
			snapshotDefs: [deletedSnap],
			customFields: {},
			taskTypeName: 'Delivery',
			mode: 'edit',
		});
		expect(withoutValue).toHaveLength(0);
	});

	it('respects showWhen for new fields', () => {
		const resolved = resolveTaskCustomFieldDefs({
			liveDefs: [
				{
					...liveNew,
					showWhen: { taskTypeNames: ['Install'] },
				},
			],
			snapshotDefs: [],
			customFields: {},
			taskTypeName: 'Delivery',
			mode: 'edit',
		});
		expect(resolved).toHaveLength(0);
	});
});

describe('displayDefForResolved', () => {
	it('uses snapshot type when drifted', () => {
		const resolved = resolveTaskCustomFieldDefs({
			liveDefs: [liveText],
			snapshotDefs: [snapNumber],
			customFields: { '1': 42 },
			mode: 'display',
		})[0];
		expect(displayDefForResolved(resolved).dataType).toBe('number');
	});
});

describe('hasCustomFieldStoredValue', () => {
	it('treats empty and placeholder distinctly', () => {
		expect(hasCustomFieldStoredValue(null)).toBe(false);
		expect(hasCustomFieldStoredValue('')).toBe(false);
		expect(hasCustomFieldStoredValue('x')).toBe(true);
		expect(hasCustomFieldStoredValue(0)).toBe(true);
		expect(taskHasCustomFieldValue({ '1': 'a' }, 1)).toBe(true);
	});
});

describe('applyTaskCustomFieldsUpdate', () => {
	const parseSlot = (
		_slot: number,
		raw: unknown,
		def: { dataType: string },
	) => {
		if (raw == null || raw === '') return null;
		if (def.dataType === 'text') return String(raw);
		if (def.dataType === 'number') return Number(raw);
		return raw;
	};

	it('keeps untouched drifted slots unchanged', () => {
		const result = applyTaskCustomFieldsUpdate({
			liveDefs: [liveText],
			snapshotDefs: [snapNumber],
			storedCustomFields: { '1': 42 },
			incomingCustomFields: {},
			touchedSlots: [],
			clearedSlots: [],
			parseSlot,
		});
		expect(result.customFields).toEqual({ '1': 42 });
		expect(result.snapshotDefs[0].dataType).toBe('number');
	});

	it('migrates type when slot is touched', () => {
		const result = applyTaskCustomFieldsUpdate({
			liveDefs: [liveText],
			snapshotDefs: [snapNumber],
			storedCustomFields: { '1': 42 },
			incomingCustomFields: { '1': 'hello' },
			touchedSlots: [1],
			clearedSlots: [],
			parseSlot,
		});
		expect(result.customFields).toEqual({ '1': 'hello' });
		expect(result.snapshotDefs[0].dataType).toBe('text');
		expect(result.snapshotDefs[0].label).toBe('Renamed label');
	});

	it('adds new field to snapshot when touched', () => {
		const result = applyTaskCustomFieldsUpdate({
			liveDefs: [liveNew],
			snapshotDefs: [],
			storedCustomFields: {},
			incomingCustomFields: { '2': 'new val' },
			touchedSlots: [2],
			clearedSlots: [],
			parseSlot,
		});
		expect(result.customFields).toEqual({ '2': 'new val' });
		expect(result.snapshotDefs).toHaveLength(1);
		expect(result.snapshotDefs[0].slot).toBe(2);
	});

	it('clears deleted field from task', () => {
		const result = applyTaskCustomFieldsUpdate({
			liveDefs: [],
			snapshotDefs: [deletedSnap],
			storedCustomFields: { '3': 'gone value' },
			incomingCustomFields: {},
			touchedSlots: [],
			clearedSlots: [3],
			parseSlot,
		});
		expect(result.customFields).toEqual({});
		expect(result.snapshotDefs).toHaveLength(0);
	});
});
