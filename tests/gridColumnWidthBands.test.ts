import { describe, expect, it } from 'vitest';
import type { ColumnState } from 'ag-grid-community';
import {
	buildColumnStateForBand,
	gridWidthBandFromPaneWidth,
	migrateLegacyColumnStateToV2,
	parseBandedGridColumnLayout,
	updateBandWidthsFromApi,
} from '../src/gridColumnWidthBands';

describe('gridWidthBandFromPaneWidth', () => {
	it('uses pane width only (not column sum)', () => {
		expect(gridWidthBandFromPaneWidth(1280)).toBe('narrow');
		expect(gridWidthBandFromPaneWidth(1281)).toBe('medium');
		expect(gridWidthBandFromPaneWidth(1999)).toBe('medium');
		expect(gridWidthBandFromPaneWidth(2000)).toBe('wide');
		expect(gridWidthBandFromPaneWidth(2100)).toBe('wide');
	});
});

describe('parseBandedGridColumnLayout', () => {
	it('migrates legacy column state array into wide band', () => {
		const legacy: ColumnState[] = [
			{ colId: 'a', width: 120, sort: 'asc', sortIndex: 0 },
			{ colId: 'b', width: 200 },
		];
		const layout = parseBandedGridColumnLayout(legacy);
		expect(layout?.v).toBe(2);
		expect(layout?.order).toEqual(['a', 'b']);
		expect(layout?.widthsByBand.wide).toEqual({ a: 120, b: 200 });
		expect(layout?.sort).toEqual([
			{ colId: 'a', sort: 'asc', sortIndex: 0 },
		]);
	});

	it('round-trips v2 shape', () => {
		const v2 = {
			v: 2,
			order: ['x', 'y'],
			sort: [],
			widthsByBand: {
				medium: { x: 100, y: 150 },
			},
		};
		expect(parseBandedGridColumnLayout(v2)).toEqual(v2);
	});
});

describe('buildColumnStateForBand', () => {
	it('applies band widths and shared sort', () => {
		const layout = migrateLegacyColumnStateToV2([
			{ colId: 'a', width: 80, sort: 'desc', sortIndex: 0 },
			{ colId: 'b', width: 80 },
		]);
		layout.widthsByBand.medium = { a: 140, b: 160 };
		const state = buildColumnStateForBand(layout, 'medium');
		expect(state).toEqual([
			{ colId: 'a', width: 140, sort: 'desc', sortIndex: 0 },
			{ colId: 'b', width: 160 },
		]);
	});
});

describe('updateBandWidthsFromApi', () => {
	it('writes only the requested band', () => {
		const layout = parseBandedGridColumnLayout({
			v: 2,
			order: ['a'],
			sort: [],
			widthsByBand: { wide: { a: 300 } },
		})!;
		const next = updateBandWidthsFromApi(layout, 'narrow', [
			{ colId: 'a', width: 90 },
		]);
		expect(next.widthsByBand.wide).toEqual({ a: 300 });
		expect(next.widthsByBand.narrow).toEqual({ a: 90 });
	});
});
