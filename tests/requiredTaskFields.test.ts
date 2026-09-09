import { describe, expect, it } from 'vitest';
import {
	REQUIRED_TASK_FIELDS,
	assertRequiredTaskFields,
	isBlankTaskDesc,
	normalizeRequiredTaskFields,
	requiredTaskFieldError,
	requiredTaskFieldLabel,
	requiredTaskFieldsFromDb,
} from '../shared/requiredTaskFields.js';

const FILLED = {
	externalKey: '12345',
	jobTitle: 'Install TV',
	taskDesc: '<p>Do the work</p>',
	contactIds: [1],
	destinationAddressName: 'Venue',
	destinationAddress: '1 Main St',
	destinationBuilding: 'B1',
	destinationNotes: 'Gate code 1',
	afterDateTime: '2026-09-02T12:00:00.000Z',
	beforeDateTime: '2026-09-02T16:00:00.000Z',
	crewMemberIds: ['user-1'],
};

describe('normalizeRequiredTaskFields', () => {
	it('accepts known keys and drops duplicates', () => {
		expect(
			normalizeRequiredTaskFields(['contacts', 'contacts', 'crew']),
		).toEqual(['contacts', 'crew']);
	});

	it('throws 400 on unknown keys', () => {
		expect(() => normalizeRequiredTaskFields(['notAField'])).toThrow(
			/Unknown required field/,
		);
	});
});

describe('requiredTaskFieldsFromDb', () => {
	it('drops unknown keys without throwing', () => {
		expect(requiredTaskFieldsFromDb(['contacts', 'nope', 3])).toEqual([
			'contacts',
		]);
	});
});

describe('requiredTaskFieldLabel', () => {
	it('uses the org external key label when provided', () => {
		expect(
			requiredTaskFieldLabel(REQUIRED_TASK_FIELDS.externalKey, {
				externalKeyLabel: 'Job',
			}),
		).toBe('External Key: Job');
	});
});

describe('isBlankTaskDesc', () => {
	it('treats empty editor HTML as blank', () => {
		expect(isBlankTaskDesc('<p></p>')).toBe(true);
		expect(isBlankTaskDesc('<p>Notes</p>')).toBe(false);
	});
});

describe('requiredTaskFieldError', () => {
	it('returns null when nothing is required', () => {
		expect(requiredTaskFieldError({}, [])).toBeNull();
	});

	it('reports the first missing field', () => {
		expect(
			requiredTaskFieldError(
				{ ...FILLED, contactIds: [] },
				['contacts', 'crew'],
			),
		).toBe('Contacts is required');
	});
});

describe('assertRequiredTaskFields', () => {
	it('throws 400 when a required field is missing', () => {
		expect(() =>
			assertRequiredTaskFields({ ...FILLED, jobTitle: '' }, ['jobTitle']),
		).toThrow(/Job title is required/);
	});
});
