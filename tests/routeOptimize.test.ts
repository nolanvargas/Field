import { describe, expect, it, vi } from 'vitest';
import {
	formatTaskGeocodeQueries,
	formatTaskGeocodeQuery,
	formatTaskStreetQuery,
	resolveTaskCoordinates,
} from '../server/geocoding.mjs';

describe('formatTaskStreetQuery', () => {
	it('joins street and building', () => {
		expect(
			formatTaskStreetQuery({
				destination_address: '123 Main St',
				destination_building: 'Suite 4',
			}),
		).toBe('123 Main St, Suite 4');
	});
});

describe('formatTaskGeocodeQueries', () => {
	it('prefers street address before venue name', () => {
		expect(
			formatTaskGeocodeQueries({
				destination_address_name: 'Mandalay Bay',
				destination_address: '3950 S Las Vegas Blvd, Las Vegas, NV 89119',
				destination_building: 'Sign shop',
			}),
		).toEqual([
			'3950 S Las Vegas Blvd, Las Vegas, NV 89119',
			'3950 S Las Vegas Blvd, Las Vegas, NV 89119, Sign shop',
			'Mandalay Bay, 3950 S Las Vegas Blvd, Las Vegas, NV 89119, Sign shop',
			'Mandalay Bay',
		]);
	});

	it('does not let venue name override a known street address', () => {
		expect(
			formatTaskGeocodeQueries({
				destination_address_name: 'Cirque Warehouse',
				destination_address: '6325 S Pecos Rd, Las Vegas, NV 89120',
				destination_building: 'Warehouse B',
			})[0],
		).toBe('6325 S Pecos Rd, Las Vegas, NV 89120');
	});
});

describe('formatTaskGeocodeQuery', () => {
	it('returns the first geocode candidate', () => {
		expect(
			formatTaskGeocodeQuery({
				destination_address_name: 'Park MGM',
				destination_address: '3770 S Las Vegas Blvd',
				destination_building: 'Loading dock',
			}),
		).toBe('3770 S Las Vegas Blvd');
	});
});

describe('resolveTaskCoordinates', () => {
	it('prefers task destination coordinates', () => {
		expect(
			resolveTaskCoordinates({
				destination_latitude: 36.1,
				destination_longitude: -115.1,
				address_latitude: 36.2,
				address_longitude: -115.2,
			}),
		).toEqual({ lat: 36.1, lng: -115.1 });
	});

	it('falls back to linked address catalog coordinates', () => {
		expect(
			resolveTaskCoordinates({
				destination_latitude: null,
				destination_longitude: null,
				address_latitude: 36.2,
				address_longitude: -115.2,
			}),
		).toEqual({ lat: 36.2, lng: -115.2 });
	});

	it('returns null when no stored coordinates exist', () => {
		expect(
			resolveTaskCoordinates({
				destination_latitude: null,
				destination_longitude: null,
				address_latitude: null,
				address_longitude: null,
				destination_address: '123 Main St',
			}),
		).toBeNull();
	});
});

describe('openMapsNavigationCoords', () => {
	it('opens coordinate destination URLs in a new tab on desktop', async () => {
		const { openMapsNavigationCoords } = await import('../src/openMapsNavigation');
		const open = vi.spyOn(window, 'open').mockReturnValue(null);

		openMapsNavigationCoords({ latitude: 36.1699, longitude: -115.1398 });

		expect(open).toHaveBeenCalledWith(
			'https://www.google.com/maps/dir/?api=1&destination=36.1699%2C-115.1398',
			'_blank',
			'noopener,noreferrer',
		);

		open.mockRestore();
	});
});
