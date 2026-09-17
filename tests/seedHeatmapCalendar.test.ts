import { describe, expect, it } from 'vitest';
import {
	buildHeatmapDayTargets,
	monthGridDayKeys,
} from '../scripts/lib/seedDevTasksEnrich.mjs';

describe('seed heatmap calendar', () => {
	it('month grid is 42 Sun-start days', () => {
		const keys = monthGridDayKeys('2026-09-15');
		expect(keys).toHaveLength(42);
		expect(keys[0]).toBe('2026-08-30');
		expect(keys[keys.length - 1]).toBe('2026-10-10');
	});

	it('builds 500-task targets with weekend and weekday rules', () => {
		const targets = buildHeatmapDayTargets('2026-09-15', 500);
		expect(targets.size).toBe(42);

		const gridKeys = monthGridDayKeys('2026-09-15');
		for (const key of gridKeys) {
			const count = targets.get(key) ?? 0;
			const dow = new Date(`${key}T12:00:00`).getDay();
			if (dow === 0) {
				expect(count).toBeGreaterThanOrEqual(0);
				expect(count).toBeLessThanOrEqual(2);
			} else if (dow === 6) {
				expect(count).toBeGreaterThanOrEqual(3);
				expect(count).toBeLessThanOrEqual(7);
			} else {
				expect(count).toBeGreaterThanOrEqual(10);
			}
		}

		const total = [...targets.values()].reduce((sum, count) => sum + count, 0);
		expect(total).toBe(500);
	});
});
