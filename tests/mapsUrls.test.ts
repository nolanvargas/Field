import { describe, expect, it } from 'vitest';
import {
	buildMultistopMapsUrl,
	reorderStopsByOptimizedIndexes,
} from '../server/mapsUrls.mjs';

const stops = [
	{ latitude: 36.1, longitude: -115.17 },
	{ latitude: 36.2, longitude: -115.18 },
	{ latitude: 36.3, longitude: -115.19 },
];

describe('buildMultistopMapsUrl', () => {
	it('builds Apple Maps URL with destination and waypoints', () => {
		const url = buildMultistopMapsUrl(stops, 'ios');
		expect(url).toMatch(/^https:\/\/maps\.apple\.com\/directions\?/);
		expect(url).toContain('mode=driving');
		expect(url).toContain('destination=36.3%2C-115.19');
		expect(url).toContain('waypoint=36.1%2C-115.17');
		expect(url).toContain('waypoint=36.2%2C-115.18');
	});

	it('builds Google Maps URL with pipe-separated waypoints', () => {
		const url = buildMultistopMapsUrl(stops, 'android');
		expect(url).toMatch(/^https:\/\/www\.google\.com\/maps\/dir\/\?/);
		expect(url).toContain('api=1');
		expect(url).toContain('travelmode=driving');
		expect(url).toContain('destination=36.3%2C-115.19');
		expect(url).toContain('waypoints=36.1%2C-115.17%7C36.2%2C-115.18');
	});

	it('uses Google Maps URL for web', () => {
		const url = buildMultistopMapsUrl(stops, 'web');
		expect(url).toContain('google.com/maps/dir');
	});

	it('supports a single stop', () => {
		const url = buildMultistopMapsUrl([stops[0]], 'ios');
		expect(url).toContain('destination=36.1%2C-115.17');
		expect(url).not.toContain('waypoint=');
	});

	it('rejects an empty stop list', () => {
		expect(() => buildMultistopMapsUrl([], 'ios')).toThrow(
			/At least one stop/,
		);
	});
});

describe('reorderStopsByOptimizedIndexes', () => {
	const anchor = { latitude: 36.15, longitude: -115.175 };

	it('reorders all stops when origin equals destination (round-trip optimization)', () => {
		const items = ['a', 'b', 'c', 'd'];
		const ordered = reorderStopsByOptimizedIndexes(
			items,
			[2, 0, 3, 1],
			anchor,
			anchor,
		);
		expect(ordered).toEqual(['c', 'a', 'd', 'b']);
	});

	it('reorders only middle stops when origin and destination differ', () => {
		const items = ['start', 'b', 'c', 'end'];
		const ordered = reorderStopsByOptimizedIndexes(
			items,
			[1, 0],
			{ latitude: 1, longitude: 1 },
			{ latitude: 2, longitude: 2 },
		);
		expect(ordered).toEqual(['start', 'c', 'b', 'end']);
	});

	it('returns input order when indexes are missing', () => {
		const items = ['a', 'b'];
		expect(
			reorderStopsByOptimizedIndexes(items, [], anchor, anchor),
		).toEqual(['a', 'b']);
	});
});
