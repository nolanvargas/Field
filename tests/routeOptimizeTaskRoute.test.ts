/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbMocks = vi.hoisted(() => ({
	query: vi.fn(),
}));

const geoMocks = vi.hoisted(() => ({
	getGoogleMapsApiKey: vi.fn(),
}));

vi.mock('../server/db.mjs', () => ({
	getPool: () => ({ query: dbMocks.query }),
}));

vi.mock('../server/geocoding.mjs', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../server/geocoding.mjs')>();
	return {
		...actual,
		getGoogleMapsApiKey: geoMocks.getGoogleMapsApiKey,
	};
});

function taskRow(
	id: number,
	lat: number | null,
	lng: number | null,
	address = '123 Main St',
) {
	return {
		id,
		destination_address_id: null,
		destination_latitude: lat,
		destination_longitude: lng,
		address_latitude: null,
		address_longitude: null,
		destination_address_name: '',
		destination_address: address,
		destination_building: '',
	};
}

describe('optimizeTaskRoute', () => {
	beforeEach(() => {
		dbMocks.query.mockReset();
		geoMocks.getGoogleMapsApiKey.mockReset();
		geoMocks.getGoogleMapsApiKey.mockReturnValue('test-key');
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({
					routes: [{ optimizedIntermediateWaypointIndex: [2, 0, 1] }],
				}),
			}),
		);
		vi.spyOn(console, 'warn').mockImplementation(() => {});
	});

	it('rejects invalid taskIds', async () => {
		const { optimizeTaskRoute } = await import('../server/routeOptimize.mjs');
		await expect(optimizeTaskRoute({ taskIds: [] })).rejects.toMatchObject({
			status: 400,
		});
		await expect(optimizeTaskRoute({ taskIds: [0] })).rejects.toMatchObject({
			status: 400,
		});
	});

	it('returns optimized order and a multistop maps URL', async () => {
		dbMocks.query.mockResolvedValueOnce({
			rows: [taskRow(1, 36.1, -115.1), taskRow(2, 36.2, -115.2), taskRow(3, 36.3, -115.3)],
			rowCount: 3,
		});

		const { optimizeTaskRoute } = await import('../server/routeOptimize.mjs');
		const result = await optimizeTaskRoute({
			taskIds: [1, 2, 3],
			platform: 'android',
		});

		expect(result.orderedTaskIds).toEqual([3, 1, 2]);
		expect(result.mapsUrl).toContain('google.com/maps/dir');
		expect(result.mapsUrl).toContain('travelmode=driving');
		expect(result.skipped).toEqual([]);
	});

	it('skips tasks without coordinates and requires at least two resolved stops', async () => {
		dbMocks.query.mockResolvedValueOnce({
			rows: [taskRow(1, 36.1, -115.1), taskRow(2, null, null, '')],
			rowCount: 2,
		});

		const { optimizeTaskRoute } = await import('../server/routeOptimize.mjs');
		await expect(optimizeTaskRoute({ taskIds: [1, 2] })).rejects.toMatchObject({
			status: 400,
		});
	});

	it('returns 404 when no tasks match', async () => {
		dbMocks.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

		const { optimizeTaskRoute } = await import('../server/routeOptimize.mjs');
		await expect(optimizeTaskRoute({ taskIds: [99] })).rejects.toMatchObject({
			status: 404,
		});
	});

	it('returns 503 when the maps API key is missing', async () => {
		geoMocks.getGoogleMapsApiKey.mockReturnValue('');
		dbMocks.query.mockResolvedValueOnce({
			rows: [taskRow(1, 36.1, -115.1), taskRow(2, 36.2, -115.2)],
			rowCount: 2,
		});

		const { optimizeTaskRoute } = await import('../server/routeOptimize.mjs');
		await expect(optimizeTaskRoute({ taskIds: [1, 2] })).rejects.toMatchObject({
			status: 503,
		});
	});
});
