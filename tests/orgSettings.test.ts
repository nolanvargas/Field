import { describe, expect, it } from 'vitest';
import {
	normalizeAndValidateTaskTypes,
	slugifyTaskType,
	lookupTaskByExternalQuery,
} from '../server/orgSettings.mjs';

describe('slugifyTaskType', () => {
	it('converts mixed case and spaces to lower-case hyphenated slug', () => {
		expect(slugifyTaskType('Site Survey')).toBe('site-survey');
		expect(slugifyTaskType('Delivery')).toBe('delivery');
		expect(slugifyTaskType('Pick-up & Drop-off')).toBe('pick-up-drop-off');
	});

	it('strips leading and trailing hyphens/spaces', () => {
		expect(slugifyTaskType('  ---Special Task---  ')).toBe('special-task');
	});

	it('falls back to default for empty string', () => {
		expect(slugifyTaskType('')).toBe('type');
	});
});

describe('normalizeAndValidateTaskTypes', () => {
	it('auto-generates slugs and retains attributes', () => {
		const result = normalizeAndValidateTaskTypes([
			{
				name: 'Delivery',
				icon: 'Truck',
				enabled: true,
				sortOrder: 0,
			},
			{
				name: 'Site Survey',
				icon: 'ClipboardCheck',
				enabled: true,
				sortOrder: 1,
			},
		]);

		expect(result).toEqual([
			{
				name: 'Delivery',
				slug: 'delivery',
				icon: 'Truck',
				enabled: true,
				sortOrder: 0,
				pluralName: '',
			},
			{
				name: 'Site Survey',
				slug: 'site-survey',
				icon: 'ClipboardCheck',
				enabled: true,
				sortOrder: 1,
				pluralName: '',
			},
		]);
	});

	it('throws 400 when task type name is empty or missing', () => {
		expect(() =>
			normalizeAndValidateTaskTypes([{ name: '   ' }]),
		).toThrow(/Each task type must have a name/);
	});

	it('throws 400 when task type name has no alphanumeric characters', () => {
		expect(() =>
			normalizeAndValidateTaskTypes([{ name: '---' }]),
		).toThrow(/must contain at least one letter or number/);
	});

	it('throws 400 when task type name exceeds 100 characters', () => {
		const longName = 'A'.repeat(101);
		expect(() =>
			normalizeAndValidateTaskTypes([{ name: longName }]),
		).toThrow(/100 characters or less/);
	});

	it('throws 400 on duplicate task type names (case-insensitive)', () => {
		expect(() =>
			normalizeAndValidateTaskTypes([
				{ name: 'Delivery' },
				{ name: 'delivery' },
			]),
		).toThrow(/Duplicate task type name/);
	});

	it('resolves slug collisions automatically', () => {
		const result = normalizeAndValidateTaskTypes([
			{ name: 'Type A' },
			{ name: 'Type-A' },
		]);
		expect(result[0].slug).toBe('type-a');
		expect(result[1].slug).toBe('type-a-2');
	});
});

describe('lookupTaskByExternalQuery', () => {
	it('is exported as a function', () => {
		expect(typeof lookupTaskByExternalQuery).toBe('function');
	});
});
