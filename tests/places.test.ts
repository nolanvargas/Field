import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
	formatAddressGeocodeQuery,
	parsePlaceDetails,
	searchPlaceTopMatch,
} from '../server/places.mjs';
import { formatAddressGeocodeQueries } from '../server/geocoding.mjs';

describe('formatAddressGeocodeQueries', () => {
	it('builds street-first geocode queries for addresses', () => {
		expect(
			formatAddressGeocodeQueries({
				addressName: 'Mandalay Bay',
				streetLine: '3950 S Las Vegas Blvd, Las Vegas, NV 89119',
				building: 'Sign shop',
			}),
		).toEqual([
			'3950 S Las Vegas Blvd, Las Vegas, NV 89119',
			'3950 S Las Vegas Blvd, Las Vegas, NV 89119, Sign shop',
			'Mandalay Bay, 3950 S Las Vegas Blvd, Las Vegas, NV 89119, Sign shop',
			'Mandalay Bay',
		]);
	});
});

describe('formatAddressGeocodeQuery', () => {
	it('returns the first address geocode candidate', () => {
		expect(
			formatAddressGeocodeQuery({
				addressName: 'Park MGM',
				streetLine: '3770 S Las Vegas Blvd',
			}),
		).toBe('3770 S Las Vegas Blvd');
	});
});

describe('parsePlaceDetails', () => {
	it('parses Places API place resource shape', () => {
		expect(
			parsePlaceDetails({
				id: 'places/ChIJabc123',
				formattedAddress: '123 Main St, Las Vegas, NV',
				displayName: { text: 'Example Venue' },
				location: { latitude: 36.1, longitude: -115.2 },
			}),
		).toEqual({
			placeId: 'ChIJabc123',
			latitude: 36.1,
			longitude: -115.2,
			formattedAddress: '123 Main St, Las Vegas, NV',
			formattedStreetLine: '123 Main St, Las Vegas, NV',
			displayName: 'Example Venue',
		});
	});
});

describe('searchPlaceTopMatch', () => {
	const originalFetch = globalThis.fetch;

	beforeEach(() => {
		process.env.GOOGLE_MAPS_API_KEY = 'test-key';
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		vi.restoreAllMocks();
	});

	it('returns the first text-search place', async () => {
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				places: [
					{
						id: 'places/ChIJxyz',
						formattedAddress: '3950 S Las Vegas Blvd',
						location: { latitude: 36.09, longitude: -115.17 },
					},
				],
			}),
		});

		const place = await searchPlaceTopMatch('Mandalay Bay');
		expect(place.placeId).toBe('ChIJxyz');
		expect(place.latitude).toBe(36.09);
	});
});
