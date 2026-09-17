import { describe, expect, it } from 'vitest';
import {
	pageHeaderTitleFits,
	pageHeaderTitleLayout,
} from '../src/pageHeaderTitleFits';

describe('pageHeaderTitleLayout', () => {
	it('stacks when the header is narrow and the left slot is used', () => {
		expect(
			pageHeaderTitleLayout({
				headerWidth: 700,
				rem: 16,
				hasLeft: true,
				hasRight: true,
			}),
		).toBe('stacked');
	});

	it('uses a shared row when the header is narrow and only the right slot is used', () => {
		expect(
			pageHeaderTitleLayout({
				headerWidth: 700,
				rem: 16,
				hasLeft: false,
				hasRight: true,
			}),
		).toBe('row');
	});

	it('splits when the header is wide and both slots are used', () => {
		expect(
			pageHeaderTitleLayout({
				headerWidth: 900,
				rem: 16,
				hasLeft: true,
				hasRight: true,
			}),
		).toBe('split');
	});
});

const wideViewport = { viewportWidth: 1400 };

describe('pageHeaderTitleFits', () => {
	it('hides the title below 1200px viewport', () => {
		expect(
			pageHeaderTitleFits({
				headerWidth: 1400,
				titleWidth: 80,
				leftWidth: 0,
				rightWidth: 0,
				gap: 12,
				layout: 'row',
				viewportWidth: 1199,
			}),
		).toBe(false);
	});

	it('hides a row title that cannot sit beside the controls', () => {
		expect(
			pageHeaderTitleFits({
				headerWidth: 200,
				titleWidth: 80,
				leftWidth: 0,
				rightWidth: 140,
				gap: 12,
				layout: 'row',
				...wideViewport,
			}),
		).toBe(false);
	});

	it('shows a row title when the full word fits', () => {
		expect(
			pageHeaderTitleFits({
				headerWidth: 400,
				titleWidth: 80,
				leftWidth: 0,
				rightWidth: 140,
				gap: 12,
				layout: 'row',
				...wideViewport,
			}),
		).toBe(true);
	});

	it('hides an overlay title that would collide with a side slot', () => {
		expect(
			pageHeaderTitleFits({
				headerWidth: 600,
				titleWidth: 80,
				leftWidth: 320,
				rightWidth: 0,
				gap: 12,
				layout: 'overlay',
				...wideViewport,
			}),
		).toBe(false);
	});

	it('hides a split title that cannot sit between the controls', () => {
		expect(
			pageHeaderTitleFits({
				headerWidth: 400,
				titleWidth: 80,
				leftWidth: 200,
				rightWidth: 200,
				gap: 12,
				layout: 'split',
				...wideViewport,
			}),
		).toBe(false);
	});

	it('keeps a stacked title that fits the header width', () => {
		expect(
			pageHeaderTitleFits({
				headerWidth: 400,
				titleWidth: 80,
				leftWidth: 300,
				rightWidth: 200,
				gap: 12,
				layout: 'stacked',
				...wideViewport,
			}),
		).toBe(true);
	});
});
