/** @vitest-environment node */
import { describe, expect, it } from 'vitest';
import {
	ALL_CUSTOM_FIELD_ENTITIES,
	CUSTOM_FIELD_ENTITIES,
	CUSTOM_FIELD_ENTITY_LABELS,
	assertCustomFieldEntity,
	byCustomFieldEntity,
	customFieldDefsByEntityFrom,
	isCustomFieldEntity,
} from '../shared/customFieldEntities.js';

describe('isCustomFieldEntity', () => {
	it('accepts known entity types', () => {
		for (const entity of ALL_CUSTOM_FIELD_ENTITIES) {
			expect(isCustomFieldEntity(entity)).toBe(true);
		}
	});

	it('rejects unknown and non-string values', () => {
		expect(isCustomFieldEntity('team')).toBe(false);
		expect(isCustomFieldEntity(null)).toBe(false);
		expect(isCustomFieldEntity(1)).toBe(false);
	});
});

describe('assertCustomFieldEntity', () => {
	it('returns the entity for valid values', () => {
		expect(assertCustomFieldEntity('contact')).toBe('contact');
	});

	it('throws 400 for unknown entities', () => {
		expect(() => assertCustomFieldEntity('vehicle')).toThrowError(
			/Unknown custom field entity: vehicle/,
		);
		try {
			assertCustomFieldEntity('vehicle');
		} catch (err) {
			expect(err).toMatchObject({ status: 400 });
		}
	});
});

describe('byCustomFieldEntity', () => {
	it('builds a record with every entity key', () => {
		const out = byCustomFieldEntity(() => []);
		expect(Object.keys(out).sort()).toEqual(
			[...ALL_CUSTOM_FIELD_ENTITIES].sort(),
		);
		expect(out[CUSTOM_FIELD_ENTITIES.task]).toEqual([]);
	});
});

describe('customFieldDefsByEntityFrom', () => {
	it('normalizes missing or invalid buckets to empty arrays', () => {
		expect(customFieldDefsByEntityFrom(null)).toEqual({
			task: [],
			user: [],
			contact: [],
			address: [],
		});
	});

	it('keeps arrays and ignores non-array values', () => {
		const defs = [{ slot: 1 }];
		const out = customFieldDefsByEntityFrom({
			task: defs,
			user: 'bad',
		});
		expect(out.task).toBe(defs);
		expect(out.user).toEqual([]);
	});
});

describe('CUSTOM_FIELD_ENTITY_LABELS', () => {
	it('labels every entity', () => {
		for (const entity of ALL_CUSTOM_FIELD_ENTITIES) {
			expect(CUSTOM_FIELD_ENTITY_LABELS[entity]).toBeTruthy();
		}
	});
});
