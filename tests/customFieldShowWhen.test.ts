import { describe, expect, it } from 'vitest';
import {
	isCustomFieldVisible,
	normalizeShowWhen,
} from '../shared/customFieldShowWhen.js';

describe('normalizeShowWhen', () => {
	it('returns null for empty or invalid input', () => {
		expect(normalizeShowWhen(null)).toBeNull();
		expect(normalizeShowWhen({})).toBeNull();
		expect(normalizeShowWhen({ taskTypeNames: [] })).toBeNull();
		expect(normalizeShowWhen({ taskTypeNames: ['  '] })).toBeNull();
	});

	it('trims, drops blanks, and dedupes case-insensitively', () => {
		expect(
			normalizeShowWhen({
				taskTypeNames: ['Install', ' install ', 'Removal', ''],
			}),
		).toEqual({ taskTypeNames: ['Install', 'Removal'] });
	});
});

describe('isCustomFieldVisible', () => {
	const restricted = {
		showWhen: { taskTypeNames: ['Install', 'Removal'] },
	};

	it('is always visible when showWhen is empty', () => {
		expect(isCustomFieldVisible({ showWhen: null }, 'Delivery')).toBe(true);
		expect(isCustomFieldVisible({}, '')).toBe(true);
	});

	it('hides until a matching task type is chosen', () => {
		expect(isCustomFieldVisible(restricted, '')).toBe(false);
		expect(isCustomFieldVisible(restricted, 'Delivery')).toBe(false);
		expect(isCustomFieldVisible(restricted, 'Install')).toBe(true);
		expect(isCustomFieldVisible(restricted, 'install')).toBe(true);
	});
});
