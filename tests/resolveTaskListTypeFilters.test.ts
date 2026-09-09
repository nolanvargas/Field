import { describe, expect, it } from 'vitest';
import { resolveTaskListTypeFilters } from '../shared/resolveTaskListTypeFilters.js';

const enabled = ['Delivery', 'Install', 'Pickup'];

describe('resolveTaskListTypeFilters', () => {
	it('prefers user filters over URL', () => {
		expect(
			resolveTaskListTypeFilters({
				userFilters: ['Install'],
				urlTypeFilter: 'Pickup',
				enabledTypeNames: enabled,
			}),
		).toEqual(['Install']);
	});

	it('uses user filters when set', () => {
		expect(
			resolveTaskListTypeFilters({
				userFilters: ['Install', 'Pickup'],
				enabledTypeNames: enabled,
			}),
		).toEqual(['Install', 'Pickup']);
	});

	it('falls back to URL type on desktop All Tasks', () => {
		expect(
			resolveTaskListTypeFilters({
				urlTypeFilter: 'Delivery',
				enabledTypeNames: enabled,
			}),
		).toEqual(['Delivery']);
	});

	it('drops unknown or disabled types when enabled list is provided', () => {
		expect(
			resolveTaskListTypeFilters({
				userFilters: ['Delivery', 'Removed'],
				enabledTypeNames: enabled,
			}),
		).toEqual(['Delivery']);
	});

	it('returns empty when nothing is filtered', () => {
		expect(resolveTaskListTypeFilters({ enabledTypeNames: enabled })).toEqual(
			[],
		);
	});
});
