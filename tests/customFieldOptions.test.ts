import { describe, expect, it } from 'vitest';
import { normalizeCustomFieldOptions as serverNormalizeCustomFieldOptions } from '../server/customFields.mjs';
import {
	formatCustomFieldOptionsSummary,
	normalizeCustomFieldOptions,
} from '../src/customFields';

/** Mirrors CustomFieldOptionsEditor handleDone: normalize draft, then display summary. */
function saveDraftOptions(draftOptions: string[]) {
	const value = normalizeCustomFieldOptions(draftOptions);
	return { value, summary: formatCustomFieldOptionsSummary(value) };
}

const PARITY_FIXTURES: Array<{ input: unknown[]; expected: string[] }> = [
	{ input: [], expected: [] },
	{ input: ['  Red  ', '', '  ', 'Blue'], expected: ['Red', 'Blue'] },
	{ input: ['Red', 'Blue', 'Red', 'red'], expected: ['Red', 'Blue', 'red'] },
	{ input: ['', '  ', '\t'], expected: [] },
	{ input: [null, undefined, 'Red'], expected: ['Red'] },
	{ input: [1, true, '1'], expected: ['1', 'true'] },
	{ input: [' Red', 'Red ', 'Red'], expected: ['Red'] },
	{ input: ['\n', '\r\n', '\u00a0'], expected: [] },
	{ input: ['  café  ', '🔴 Red'], expected: ['café', '🔴 Red'] },
	{
		input: ['<script>alert(1)</script>', "'; DROP TABLE--"],
		expected: ['<script>alert(1)</script>', "'; DROP TABLE--"],
	},
];

describe('normalizeCustomFieldOptions', () => {
	it('returns empty array for empty input', () => {
		expect(normalizeCustomFieldOptions([])).toEqual([]);
	});

	it('trims whitespace and drops blanks', () => {
		expect(normalizeCustomFieldOptions(['  Red  ', '', '  ', 'Blue'])).toEqual([
			'Red',
			'Blue',
		]);
	});

	it('dedupes case-sensitively, keeping first occurrence', () => {
		expect(
			normalizeCustomFieldOptions(['Red', 'Blue', 'Red', 'red']),
		).toEqual(['Red', 'Blue', 'red']);
	});

	it('returns empty array for all-blank input', () => {
		expect(normalizeCustomFieldOptions(['', '  ', '\t'])).toEqual([]);
	});

	it('drops null and undefined elements', () => {
		expect(
			normalizeCustomFieldOptions([null, undefined, 'Red'] as string[]),
		).toEqual(['Red']);
	});

	it('coerces non-string elements and dedupes after coercion', () => {
		expect(normalizeCustomFieldOptions([1, true, '1'] as string[])).toEqual([
			'1',
			'true',
		]);
		expect(normalizeCustomFieldOptions([{}] as string[])).toEqual([
			'[object Object]',
		]);
	});

	it('dedupes after trim', () => {
		expect(normalizeCustomFieldOptions([' Red', 'Red ', 'Red'])).toEqual(['Red']);
	});

	it('treats newline and nbsp-only strings as blank', () => {
		expect(normalizeCustomFieldOptions(['\n', '\r\n', '\u00a0'])).toEqual([]);
	});

	it('preserves unicode and emoji labels', () => {
		expect(normalizeCustomFieldOptions(['  café  ', '🔴 Red'])).toEqual([
			'café',
			'🔴 Red',
		]);
	});

	it('preserves order when skipping duplicates', () => {
		expect(
			normalizeCustomFieldOptions(['Z', 'A', 'Z', 'B', 'A', 'C']),
		).toEqual(['Z', 'A', 'B', 'C']);
	});

	it('passes through adversarial strings unchanged after trim', () => {
		for (const value of [
			'<script>alert(1)</script>',
			"'; DROP TABLE--",
			'<img onerror=alert(1)>',
		]) {
			expect(normalizeCustomFieldOptions([`  ${value}  `])).toEqual([value]);
		}
	});
});

describe('formatCustomFieldOptionsSummary', () => {
	it('formats empty state', () => {
		expect(formatCustomFieldOptionsSummary([])).toBe('0 options');
	});

	it('includes option names when there are one or two', () => {
		expect(formatCustomFieldOptionsSummary(['Red'])).toBe('1 option — Red');
		expect(formatCustomFieldOptionsSummary(['Red', 'Blue'])).toBe(
			'2 options — Red, Blue',
		);
	});

	it('shows count only when more than two options', () => {
		expect(formatCustomFieldOptionsSummary(['Red', 'Blue', 'Green'])).toBe(
			'3 options',
		);
	});

	it('shows names at exactly two options and count only at exactly three', () => {
		expect(formatCustomFieldOptionsSummary(['A', 'B'])).toBe(
			'2 options — A, B',
		);
		expect(formatCustomFieldOptionsSummary(['A', 'B', 'C'])).toBe('3 options');
	});

	it('does not trim or drop blank entries in the summary input', () => {
		expect(formatCustomFieldOptionsSummary([''])).toBe('1 option — ');
		expect(formatCustomFieldOptionsSummary(['  '])).toBe('1 option —   ');
	});

	it('includes commas and em dashes from option labels in the summary', () => {
		expect(formatCustomFieldOptionsSummary(['Red, Blue'])).toBe(
			'1 option — Red, Blue',
		);
		expect(formatCustomFieldOptionsSummary(['A — B', 'C'])).toBe(
			'2 options — A — B, C',
		);
	});

	it('shows count only for large lists', () => {
		const options = Array.from({ length: 10 }, (_, i) => `Option ${i + 1}`);
		expect(formatCustomFieldOptionsSummary(options)).toBe('10 options');
	});

	it('includes unicode labels when count is one or two', () => {
		expect(formatCustomFieldOptionsSummary(['café'])).toBe('1 option — café');
		expect(formatCustomFieldOptionsSummary(['café', '🔴'])).toBe(
			'2 options — café, 🔴',
		);
	});

	it('passes through adversarial labels literally in named summaries', () => {
		expect(
			formatCustomFieldOptionsSummary(['<script>alert(1)</script>']),
		).toBe('1 option — <script>alert(1)</script>');
	});
});

describe('CustomFieldOptionsEditor save contract', () => {
	it('normalizes an empty draft row to zero options', () => {
		expect(saveDraftOptions([''])).toEqual({
			value: [],
			summary: '0 options',
		});
	});

	it('normalizes trimmed draft rows and shows a two-option summary', () => {
		expect(saveDraftOptions(['  Red  ', '', 'Blue', 'Red'])).toEqual({
			value: ['Red', 'Blue'],
			summary: '2 options — Red, Blue',
		});
	});

	it('shows count-only summary when three or more unique options remain', () => {
		expect(saveDraftOptions(['A', 'B', 'C', 'A'])).toEqual({
			value: ['A', 'B', 'C'],
			summary: '3 options',
		});
	});
});

describe('normalizeCustomFieldOptions client/server parity', () => {
	it('matches server output for shared fixtures', () => {
		for (const { input, expected } of PARITY_FIXTURES) {
			expect(normalizeCustomFieldOptions(input as string[])).toEqual(expected);
			expect(serverNormalizeCustomFieldOptions(input)).toEqual(expected);
		}
	});

	it('server returns empty array for non-array input', () => {
		expect(serverNormalizeCustomFieldOptions(null)).toEqual([]);
		expect(serverNormalizeCustomFieldOptions({})).toEqual([]);
		expect(serverNormalizeCustomFieldOptions('Red')).toEqual([]);
	});
});
