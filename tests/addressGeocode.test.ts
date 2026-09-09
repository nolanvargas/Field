/** @vitest-environment node */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { hasDestinationCoords } from '../shared/destinationCoords.js';
import { geocodeAddress, mapWithConcurrency } from '../server/geocoding.mjs';

const dbMocks = vi.hoisted(() => ({ query: vi.fn() }));
const placesMocks = vi.hoisted(() => ({ searchPlaceTopMatch: vi.fn() }));

vi.mock('../server/db.mjs', () => ({
	getPool: () => ({ query: dbMocks.query }),
}));
vi.mock('../server/places.mjs', () => ({
	searchPlaceTopMatch: placesMocks.searchPlaceTopMatch,
}));

type AddressDbRow = {
	id: number;
	address_name: string | null;
	street_line: string | null;
	building: string | null;
};

let missingRows: AddressDbRow[] = [];
let addressById: Record<number, AddressDbRow | undefined> = {};

function routeDbQuery(sql: string, params?: unknown[]) {
	if (sql.includes('latitude IS NULL OR longitude IS NULL')) {
		return { rows: missingRows };
	}
	if (sql.includes('FROM addresses') && sql.includes('WHERE id = $1')) {
		const id = params?.[0] as number;
		const row = addressById[id];
		return { rows: row ? [row] : [] };
	}
	if (sql.includes('UPDATE addresses') || sql.includes('UPDATE tasks')) {
		return { rowCount: 1, rows: [] };
	}
	throw new Error(`Unexpected query: ${sql}`);
}

function resetGeocodeDbState() {
	missingRows = [];
	addressById = {};
	dbMocks.query.mockReset();
	dbMocks.query.mockImplementation(async (sql: string, params?: unknown[]) =>
		routeDbQuery(sql, params),
	);
}

describe('hasDestinationCoords', () => {
	it('accepts address latitude/longitude fields', () => {
		expect(
			hasDestinationCoords({ latitude: 36.1, longitude: -115.1 }),
		).toBe(true);
	});

	it('prefers destinationLatitude/destinationLongitude over latitude/longitude', () => {
		expect(
			hasDestinationCoords({
				destinationLatitude: 36.1,
				destinationLongitude: -115.1,
				latitude: null,
				longitude: null,
			}),
		).toBe(true);
		expect(
			hasDestinationCoords({
				destinationLatitude: 36.1,
				destinationLongitude: -115.1,
				latitude: 99,
				longitude: 99,
			}),
		).toBe(true);
	});

	it('accepts numeric string coordinates', () => {
		expect(
			hasDestinationCoords({ latitude: '36.1', longitude: '-115.1' }),
		).toBe(true);
	});

	it('returns false when only one coordinate is set', () => {
		expect(hasDestinationCoords({ latitude: 36.1 })).toBe(false);
		expect(hasDestinationCoords({ longitude: -115.1 })).toBe(false);
	});

	it('returns false for null, undefined, and empty string coordinates', () => {
		expect(
			hasDestinationCoords({ latitude: null, longitude: null }),
		).toBe(false);
		expect(
			hasDestinationCoords({ latitude: undefined, longitude: undefined }),
		).toBe(false);
		expect(hasDestinationCoords({ latitude: '', longitude: '' })).toBe(false);
	});

	it('returns false for non-finite and non-numeric values', () => {
		expect(
			hasDestinationCoords({ latitude: NaN, longitude: -115.1 }),
		).toBe(false);
		expect(
			hasDestinationCoords({ latitude: Infinity, longitude: -115.1 }),
		).toBe(false);
		expect(
			hasDestinationCoords({ latitude: 'abc', longitude: '-115.1' }),
		).toBe(false);
		expect(
			hasDestinationCoords({ latitude: '36.1abc', longitude: '-115.1' }),
		).toBe(false);
	});

	it('accepts zero coordinates as a valid finite pair', () => {
		expect(hasDestinationCoords({ latitude: 0, longitude: 0 })).toBe(true);
	});

	it('returns false for an empty row', () => {
		expect(hasDestinationCoords({})).toBe(false);
	});
});

describe('geocodeAddress', () => {
	const originalFetch = globalThis.fetch;

	beforeEach(() => {
		process.env.GOOGLE_MAPS_API_KEY = 'test-key';
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		vi.restoreAllMocks();
	});

	it('rejects when GOOGLE_MAPS_API_KEY is missing', async () => {
		delete process.env.GOOGLE_MAPS_API_KEY;

		await expect(geocodeAddress('123 Main St')).rejects.toMatchObject({
			message: expect.stringContaining('not configured'),
			status: 503,
		});
	});

	it('rejects empty and whitespace-only queries', async () => {
		await expect(geocodeAddress('')).rejects.toMatchObject({
			message: 'Address is required for geocoding',
			status: 400,
		});
		await expect(geocodeAddress('   \t')).rejects.toMatchObject({
			status: 400,
		});
	});

	it('rejects when the HTTP response is not ok', async () => {
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: false,
			status: 500,
		});

		await expect(geocodeAddress('123 Main St')).rejects.toMatchObject({
			message: 'Geocoding request failed (500)',
			status: 502,
		});
	});

	it('rejects ZERO_RESULTS with status 422', async () => {
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ status: 'ZERO_RESULTS', results: [] }),
		});

		await expect(geocodeAddress('nowhere')).rejects.toMatchObject({
			message: expect.stringContaining('ZERO_RESULTS'),
			status: 422,
		});
	});

	it('rejects REQUEST_DENIED with API detail and status 503', async () => {
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				status: 'REQUEST_DENIED',
				error_message: 'The provided API key is invalid.',
				results: [],
			}),
		});

		await expect(geocodeAddress('123 Main St')).rejects.toMatchObject({
			message: 'Geocoding API: The provided API key is invalid.',
			status: 503,
		});
	});

	it('rejects OK responses with invalid coordinates', async () => {
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				status: 'OK',
				results: [{ geometry: { location: { lat: 'bad', lng: null } } }],
			}),
		});

		await expect(geocodeAddress('123 Main St')).rejects.toMatchObject({
			message: 'Geocoding returned invalid coordinates',
			status: 502,
		});
	});

	it('returns lat/lng on success', async () => {
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				status: 'OK',
				results: [{ geometry: { location: { lat: 36.1, lng: -115.2 } } }],
			}),
		});

		await expect(geocodeAddress('123 Main St')).resolves.toEqual({
			lat: 36.1,
			lng: -115.2,
		});
	});

	it('encodes special characters in the address query parameter', async () => {
		const malicious = 'foo&bar=baz#hash 東京';
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				status: 'OK',
				results: [{ geometry: { location: { lat: 1, lng: 2 } } }],
			}),
		});

		await geocodeAddress(malicious);

		const fetchUrl = String((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]);
		const url = new URL(fetchUrl);
		expect(url.searchParams.get('address')).toBe(malicious.trim());
		expect(url.searchParams.get('key')).toBe('test-key');
		expect(fetchUrl).toContain('maps.googleapis.com/maps/api/geocode/json');
	});
});

describe('mapWithConcurrency', () => {
	it('returns an empty array for empty input', async () => {
		await expect(mapWithConcurrency([], 4, async () => 'x')).resolves.toEqual(
			[],
		);
	});

	it('preserves result order', async () => {
		const items = ['a', 'b', 'c'];
		const results = await mapWithConcurrency(items, 2, async (item) =>
			item.toUpperCase(),
		);
		expect(results).toEqual(['A', 'B', 'C']);
	});

	it('processes all items when concurrency is smaller than length', async () => {
		const seen: number[] = [];
		const items = [1, 2, 3, 4, 5];
		await mapWithConcurrency(items, 2, async (item) => {
			seen.push(item);
			return item * 2;
		});
		expect(seen.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
	});

	it('does not run workers when concurrency is zero', async () => {
		const worker = vi.fn(async (item: number) => item);
		const results = await mapWithConcurrency([1, 2, 3], 0, worker);
		expect(worker).not.toHaveBeenCalled();
		expect(results).toEqual([undefined, undefined, undefined]);
	});
});

describe('persistAddressCoordinates', () => {
	beforeEach(() => {
		resetGeocodeDbState();
	});

	it('updates the address and propagates coordinates to linked tasks', async () => {
		const { persistAddressCoordinates } = await import(
			'../server/geocodeAddresses.mjs'
		);
		const db = { query: dbMocks.query };

		await persistAddressCoordinates(db, 7, 36.1, -115.1, 'ChIJabc');

		expect(dbMocks.query).toHaveBeenCalledTimes(2);
		expect(dbMocks.query.mock.calls[0][0]).toContain('UPDATE addresses');
		expect(dbMocks.query.mock.calls[0][1]).toEqual([
			7,
			36.1,
			-115.1,
			'ChIJabc',
		]);
		expect(dbMocks.query.mock.calls[1][0]).toContain('UPDATE tasks');
		expect(dbMocks.query.mock.calls[1][0]).toContain(
			'destination_address_id = $1',
		);
		expect(dbMocks.query.mock.calls[1][1]).toEqual([7, 36.1, -115.1]);
	});
});

describe('propagateAddressCoordsToTasks', () => {
	beforeEach(() => {
		resetGeocodeDbState();
	});

	it('updates tasks linked to the address id', async () => {
		const { propagateAddressCoordsToTasks } = await import(
			'../server/geocodeAddresses.mjs'
		);
		const db = { query: dbMocks.query };

		await propagateAddressCoordsToTasks(db, 12, 36.5, -115.5);

		expect(dbMocks.query).toHaveBeenCalledTimes(1);
		expect(dbMocks.query.mock.calls[0][0]).toContain('UPDATE tasks');
		expect(dbMocks.query.mock.calls[0][1]).toEqual([12, 36.5, -115.5]);
	});
});

describe('persistTaskDestinationCoordinates', () => {
	beforeEach(() => {
		resetGeocodeDbState();
	});

	it('updates the task and syncs a valid linked address id', async () => {
		const { persistTaskDestinationCoordinates } = await import(
			'../server/geocodeAddresses.mjs'
		);
		const db = { query: dbMocks.query };

		await persistTaskDestinationCoordinates(db, 42, 36.2, -115.2, 9);

		expect(dbMocks.query).toHaveBeenCalledTimes(3);
		expect(dbMocks.query.mock.calls[0][0]).toContain('WHERE id = $1');
		expect(dbMocks.query.mock.calls[0][1]).toEqual([42, 36.2, -115.2]);
		expect(dbMocks.query.mock.calls[1][0]).toContain('UPDATE addresses');
		expect(dbMocks.query.mock.calls[1][1]).toEqual([9, 36.2, -115.2, null]);
	});

	it.each([
		['null', null],
		['undefined', undefined],
		['zero', 0],
		['negative', -1],
		['non-integer', 1.5],
	])('updates only the task when addressId is %s', async (_label, addressId) => {
		const { persistTaskDestinationCoordinates } = await import(
			'../server/geocodeAddresses.mjs'
		);
		const db = { query: dbMocks.query };

		await persistTaskDestinationCoordinates(db, 42, 36.2, -115.2, addressId);

		expect(dbMocks.query).toHaveBeenCalledTimes(1);
		expect(dbMocks.query.mock.calls[0][0]).toContain('WHERE id = $1');
	});
});

describe('loadAddressesMissingCoords', () => {
	beforeEach(() => {
		resetGeocodeDbState();
	});

	it('queries addresses missing either coordinate by default', async () => {
		missingRows = [
			{
				id: 1,
				address_name: 'Venue',
				street_line: '123 Main St',
				building: null,
			},
		];

		const { loadAddressesMissingCoords } = await import(
			'../server/geocodeAddresses.mjs'
		);
		const rows = await loadAddressesMissingCoords();

		expect(rows).toEqual([
			{
				id: 1,
				addressName: 'Venue',
				streetLine: '123 Main St',
				building: '',
			},
		]);
		const sql = String(dbMocks.query.mock.calls[0][0]);
		expect(sql).toContain('latitude IS NULL OR longitude IS NULL');
		expect(sql).not.toContain('ANY(');
		expect(sql).not.toContain('LIMIT');
	});

	it('filters by ids when a non-empty ids array is provided', async () => {
		const { loadAddressesMissingCoords } = await import(
			'../server/geocodeAddresses.mjs'
		);
		await loadAddressesMissingCoords({ ids: [1, 2] });

		const sql = String(dbMocks.query.mock.calls[0][0]);
		const params = dbMocks.query.mock.calls[0][1];
		expect(sql).toContain('ANY($1::bigint[])');
		expect(params).toEqual([[1, 2]]);
	});

	it('ignores an empty ids array', async () => {
		const { loadAddressesMissingCoords } = await import(
			'../server/geocodeAddresses.mjs'
		);
		await loadAddressesMissingCoords({ ids: [] });

		const sql = String(dbMocks.query.mock.calls[0][0]);
		expect(sql).not.toContain('ANY(');
	});

	it('applies a positive finite limit', async () => {
		const { loadAddressesMissingCoords } = await import(
			'../server/geocodeAddresses.mjs'
		);
		await loadAddressesMissingCoords({ limit: 50 });

		const sql = String(dbMocks.query.mock.calls[0][0]);
		const params = dbMocks.query.mock.calls[0][1];
		expect(sql).toContain('LIMIT $1');
		expect(params).toEqual([50]);
	});

	it.each([0, -5, Number.NaN])(
		'omits LIMIT when limit is %s',
		async (limit) => {
			const { loadAddressesMissingCoords } = await import(
				'../server/geocodeAddresses.mjs'
			);
			await loadAddressesMissingCoords({ limit });

			const sql = String(dbMocks.query.mock.calls[0][0]);
			expect(sql).not.toContain('LIMIT');
		},
	);

	it('coerces null db fields to empty strings', async () => {
		missingRows = [
			{
				id: '3' as unknown as number,
				address_name: null,
				street_line: null,
				building: null,
			},
		];

		const { loadAddressesMissingCoords } = await import(
			'../server/geocodeAddresses.mjs'
		);
		const rows = await loadAddressesMissingCoords();

		expect(rows[0]).toEqual({
			id: 3,
			addressName: '',
			streetLine: '',
			building: '',
		});
	});
});

describe('geocodeAddressesBatch', () => {
	const originalFetch = globalThis.fetch;

	beforeEach(() => {
		process.env.GOOGLE_MAPS_API_KEY = 'test-key';
		resetGeocodeDbState();
		placesMocks.searchPlaceTopMatch.mockReset();
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		vi.restoreAllMocks();
	});

	it('returns zero counts when no addresses are missing coordinates', async () => {
		const { geocodeAddressesBatch } = await import(
			'../server/geocodeAddresses.mjs'
		);

		const result = await geocodeAddressesBatch();

		expect(result).toEqual({ attempted: 0, geocoded: 0, failed: [] });
		expect(placesMocks.searchPlaceTopMatch).not.toHaveBeenCalled();
	});

	it('geocodes a row with street text and persists coordinates', async () => {
		missingRows = [
			{
				id: 1,
				address_name: null,
				street_line: '123 Main St',
				building: null,
			},
		];
		addressById[1] = missingRows[0];
		placesMocks.searchPlaceTopMatch.mockResolvedValue({
			placeId: 'ChIJxyz',
			latitude: 36.1,
			longitude: -115.1,
		});

		const { geocodeAddressesBatch } = await import(
			'../server/geocodeAddresses.mjs'
		);
		const result = await geocodeAddressesBatch();

		expect(result).toEqual({ attempted: 1, geocoded: 1, failed: [] });
		expect(placesMocks.searchPlaceTopMatch).toHaveBeenCalledWith('123 Main St');
		expect(dbMocks.query.mock.calls.some((call) =>
			String(call[0]).includes('UPDATE addresses'),
		)).toBe(true);
	});

	it('reports address not found', async () => {
		missingRows = [
			{
				id: 99,
				address_name: null,
				street_line: '123 Main St',
				building: null,
			},
		];

		const { geocodeAddressesBatch } = await import(
			'../server/geocodeAddresses.mjs'
		);
		const result = await geocodeAddressesBatch();

		expect(result).toEqual({
			attempted: 1,
			geocoded: 0,
			failed: [{ addressId: 99, reason: 'Address not found' }],
		});
	});

	it('reports when there is no address text to geocode', async () => {
		missingRows = [
			{
				id: 2,
				address_name: null,
				street_line: null,
				building: null,
			},
		];
		addressById[2] = missingRows[0];

		const { geocodeAddressesBatch } = await import(
			'../server/geocodeAddresses.mjs'
		);
		const result = await geocodeAddressesBatch();

		expect(result).toEqual({
			attempted: 1,
			geocoded: 0,
			failed: [{ addressId: 2, reason: 'No address text to geocode' }],
		});
		expect(placesMocks.searchPlaceTopMatch).not.toHaveBeenCalled();
	});

	it('tries fallback queries when the first place search fails', async () => {
		missingRows = [
			{
				id: 3,
				address_name: 'Venue',
				street_line: '123 Main St',
				building: 'Suite 1',
			},
		];
		addressById[3] = missingRows[0];
		const err422 = Object.assign(new Error('No matching place found'), {
			status: 422,
		});
		placesMocks.searchPlaceTopMatch
			.mockRejectedValueOnce(err422)
			.mockResolvedValueOnce({
				placeId: 'ChIJfallback',
				latitude: 36.2,
				longitude: -115.2,
			});

		const { geocodeAddressesBatch } = await import(
			'../server/geocodeAddresses.mjs'
		);
		const result = await geocodeAddressesBatch();

		expect(result.geocoded).toBe(1);
		expect(placesMocks.searchPlaceTopMatch).toHaveBeenCalledTimes(2);
	});

	it('propagates 503 errors from place search', async () => {
		missingRows = [
			{
				id: 4,
				address_name: null,
				street_line: '123 Main St',
				building: null,
			},
		];
		addressById[4] = missingRows[0];
		const err503 = Object.assign(
			new Error('Places API is not configured (GOOGLE_MAPS_API_KEY)'),
			{ status: 503 },
		);
		placesMocks.searchPlaceTopMatch.mockRejectedValue(err503);

		const { geocodeAddressesBatch } = await import(
			'../server/geocodeAddresses.mjs'
		);

		await expect(geocodeAddressesBatch()).rejects.toMatchObject({ status: 503 });
	});

	it('aggregates mixed success and failure results', async () => {
		missingRows = [
			{
				id: 5,
				address_name: null,
				street_line: '123 Main St',
				building: null,
			},
			{
				id: 6,
				address_name: null,
				street_line: null,
				building: null,
			},
		];
		addressById[5] = missingRows[0];
		addressById[6] = missingRows[1];
		placesMocks.searchPlaceTopMatch.mockResolvedValue({
			placeId: 'ChIJok',
			latitude: 36.3,
			longitude: -115.3,
		});

		const { geocodeAddressesBatch } = await import(
			'../server/geocodeAddresses.mjs'
		);
		const result = await geocodeAddressesBatch();

		expect(result.attempted).toBe(2);
		expect(result.geocoded).toBe(1);
		expect(result.failed).toEqual([
			{ addressId: 6, reason: 'No address text to geocode' },
		]);
	});
});
