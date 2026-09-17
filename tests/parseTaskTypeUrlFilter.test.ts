import { describe, expect, it } from 'vitest';
import {
	parseTaskTypeUrlFilter,
	serializeTaskTypeUrlFilter,
} from '../shared/parseTaskTypeUrlFilter.js';

const enabled = ['Delivery', 'Install', 'Pickup'];

describe('parseTaskTypeUrlFilter', () => {
	it('returns empty for missing or all', () => {
		expect(parseTaskTypeUrlFilter(null, enabled)).toEqual([]);
		expect(parseTaskTypeUrlFilter('all', enabled)).toEqual([]);
	});

	it('parses a single type', () => {
		expect(parseTaskTypeUrlFilter('Delivery', enabled)).toEqual(['Delivery']);
	});

	it('parses comma-separated types', () => {
		expect(parseTaskTypeUrlFilter('Delivery,Install', enabled)).toEqual([
			'Delivery',
			'Install',
		]);
	});

	it('drops unknown types', () => {
		expect(parseTaskTypeUrlFilter('Delivery,Removed', enabled)).toEqual([
			'Delivery',
		]);
	});
});

describe('serializeTaskTypeUrlFilter', () => {
	it('returns null when empty', () => {
		expect(serializeTaskTypeUrlFilter([])).toBeNull();
	});

	it('serializes one or more types', () => {
		expect(serializeTaskTypeUrlFilter(['Delivery'])).toBe('Delivery');
		expect(serializeTaskTypeUrlFilter(['Delivery', 'Install'])).toBe(
			'Delivery,Install',
		);
	});
});
