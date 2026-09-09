/**
 * Manual QA (not covered here):
 * 1. Crew Map (/crew-map, view_crew_map): markers visually overlap/merge at expected zoom with real Leaflet projection.
 * 2. +N group bubble icon and popup list all members when zoomed out.
 * 3. Zoom in/out re-clusters live (zoomend → useMemo refresh).
 * 4. Single-member markers keep per-user initials icon; group key is sorted userId join (duplicate userId in API data would break React keys).
 */
import { describe, expect, it } from 'vitest';
import type { CrewLocation } from '../src/api/crewLocations';
import {
	CREW_CLUSTER_PIXELS,
	clusterCrewLocations,
	type CrewCluster,
	type CrewMapProjector,
} from '../src/pages/crewClustering';

function loc(userId: string, latitude: number, longitude: number): CrewLocation {
	return {
		userId,
		displayName: userId,
		eventType: 'started',
		latitude,
		longitude,
		accuracyMeters: null,
		recordedAt: '2026-01-01T00:00:00Z',
		taskId: 1,
		taskType: 'Install',
		externalKey: '',
		jobTitle: '',
		destinationAddress: '',
	};
}

/** Fake map: pixels scale linearly with zoom, so distances act like a plane. */
const fakeMap: CrewMapProjector = {
	project: ([lat, lng], zoom = 1) => ({ x: lng * zoom, y: lat * zoom }),
};

function clusterUserIds(
	locations: CrewLocation[],
	zoom = 1,
	map: CrewMapProjector = fakeMap,
): string[][] {
	return clusterCrewLocations(locations, map, zoom)
		.map((cluster) => cluster.members.map((m) => m.userId).sort())
		.sort((a, b) => a.join(',').localeCompare(b.join(',')));
}

function expectPartition(input: CrewLocation[], clusters: CrewCluster[]) {
	const output = clusters.flatMap((c) => c.members);
	expect(output).toHaveLength(input.length);
	for (const loc of input) {
		expect(output.filter((m) => m === loc)).toHaveLength(1);
	}
}

describe('CREW_CLUSTER_PIXELS', () => {
	it('is 40px to match crew marker width plus padding', () => {
		expect(CREW_CLUSTER_PIXELS).toBe(40);
	});
});

describe('clusterCrewLocations', () => {
	describe('empty and single inputs', () => {
		it('returns no clusters for no locations', () => {
			expect(clusterCrewLocations([], fakeMap, 1)).toEqual([]);
		});

		it('returns one cluster for a single location at original coords', () => {
			const input = [loc('solo', 36.17, -115.14)];
			const clusters = clusterCrewLocations(input, fakeMap, 1);

			expect(clusters).toHaveLength(1);
			expect(clusters[0].members).toHaveLength(1);
			expect(clusters[0].latitude).toBe(36.17);
			expect(clusters[0].longitude).toBe(-115.14);
			expectPartition(input, clusters);
		});
	});

	describe('distance boundaries', () => {
		it('keeps far-apart crew in separate single-member clusters', () => {
			const input = [loc('a', 0, 0), loc('b', 0, 1000)];
			const clusters = clusterCrewLocations(input, fakeMap, 1);

			expect(clusters).toHaveLength(2);
			expect(clusters.every((c) => c.members.length === 1)).toBe(true);
			expectPartition(input, clusters);
		});

		it('groups points exactly at the cluster radius on the horizontal axis', () => {
			const clusters = clusterCrewLocations(
				[loc('a', 0, 0), loc('b', 0, CREW_CLUSTER_PIXELS)],
				fakeMap,
				1,
			);
			expect(clusters).toHaveLength(1);
		});

		it('keeps crew just outside the cluster radius separate', () => {
			expect(
				clusterCrewLocations(
					[loc('a', 0, 0), loc('b', 0, CREW_CLUSTER_PIXELS + 1)],
					fakeMap,
					1,
				),
			).toHaveLength(2);
		});

		it('groups points exactly at the cluster radius on the vertical axis', () => {
			expect(
				clusterCrewLocations(
					[loc('a', 0, 0), loc('b', CREW_CLUSTER_PIXELS, 0)],
					fakeMap,
					1,
				),
			).toHaveLength(1);
		});

		it('keeps crew just outside the vertical cluster radius separate', () => {
			expect(
				clusterCrewLocations(
					[loc('a', 0, 0), loc('b', CREW_CLUSTER_PIXELS + 1, 0)],
					fakeMap,
					1,
				),
			).toHaveLength(2);
		});

		it('groups points exactly at the cluster radius diagonally', () => {
			const offset = CREW_CLUSTER_PIXELS / Math.SQRT2;
			expect(
				clusterCrewLocations(
					[loc('a', 0, 0), loc('b', offset, offset)],
					fakeMap,
					1,
				),
			).toHaveLength(1);
		});
	});

	describe('multi-cluster layouts', () => {
		it('groups overlapping crew into one cluster with all members', () => {
			const input = [loc('a', 0, 0), loc('b', 0, 0.0001), loc('c', 0.0001, 0)];
			const clusters = clusterCrewLocations(input, fakeMap, 1);

			expect(clusters).toHaveLength(1);
			expect(clusters[0].members.map((m) => m.userId).sort()).toEqual([
				'a',
				'b',
				'c',
			]);
			expectPartition(input, clusters);
		});

		it('forms two independent clusters for two nearby pairs far apart', () => {
			const step = CREW_CLUSTER_PIXELS - 1;
			const input = [
				loc('a1', 0, 0),
				loc('a2', 0, step),
				loc('b1', 0, 10_000),
				loc('b2', 0, 10_000 + step),
			];
			expect(clusterUserIds(input)).toEqual([['a1', 'a2'], ['b1', 'b2']]);
		});

		it('merges crew at duplicate coordinates with different userIds', () => {
			const input = [loc('a', 10, 20), loc('b', 10, 20)];
			const clusters = clusterCrewLocations(input, fakeMap, 1);

			expect(clusters).toHaveLength(1);
			expect(clusters[0].members.map((m) => m.userId).sort()).toEqual(['a', 'b']);
			expectPartition(input, clusters);
		});
	});

	describe('centroid and member preservation', () => {
		it('places the group bubble at the centroid of two members', () => {
			const clusters = clusterCrewLocations(
				[loc('a', 0, 0), loc('b', 10, 0)],
				fakeMap,
				1,
			);
			expect(clusters).toHaveLength(1);
			expect(clusters[0].latitude).toBeCloseTo(5);
			expect(clusters[0].longitude).toBeCloseTo(0);
		});

		it('places the group bubble at the centroid of three or more members', () => {
			const clusters = clusterCrewLocations(
				[loc('a', 0, 0), loc('b', 0, 10), loc('c', 10, 0)],
				fakeMap,
				1,
			);
			expect(clusters).toHaveLength(1);
			expect(clusters[0].latitude).toBeCloseTo(10 / 3);
			expect(clusters[0].longitude).toBeCloseTo(10 / 3);
		});

		it('computes centroid correctly with negative coordinates', () => {
			const clusters = clusterCrewLocations(
				[loc('a', -10, 0), loc('b', 10, 0)],
				fakeMap,
				1,
			);
			expect(clusters).toHaveLength(1);
			expect(clusters[0].latitude).toBeCloseTo(0);
			expect(clusters[0].longitude).toBeCloseTo(0);
		});

		it('preserves original CrewLocation object references in members', () => {
			const a = loc('a', 0, 0);
			const b = loc('b', 0, 0.0001);
			const clusters = clusterCrewLocations([a, b], fakeMap, 1);

			expect(clusters[0].members).toContain(a);
			expect(clusters[0].members).toContain(b);
			expect(clusters[0].members[0].displayName).toBe('a');
		});
	});

	describe('zoom scaling', () => {
		it('merges crew when zoomed out and splits them when zoomed in', () => {
			const crew = [loc('a', 0, 0), loc('b', 0, 50)];
			expect(clusterCrewLocations(crew, fakeMap, 1)).toHaveLength(2);
			expect(clusterCrewLocations(crew, fakeMap, 0.5)).toHaveLength(1);
		});

		it('splits crew at higher zoom that merge at zoom 1', () => {
			const crew = [loc('a', 0, 0), loc('b', 0, 30)];
			expect(clusterCrewLocations(crew, fakeMap, 1)).toHaveLength(1);
			expect(clusterCrewLocations(crew, fakeMap, 2)).toHaveLength(2);
		});

		it('collapses all crew into one cluster at zoom 0', () => {
			const input = [loc('a', 0, 0), loc('b', 10, 50), loc('c', -5, 100)];
			const clusters = clusterCrewLocations(input, fakeMap, 0);

			expect(clusters).toHaveLength(1);
			expect(clusters[0].members).toHaveLength(3);
			expectPartition(input, clusters);
		});

		it('passes zoom through to the map projector', () => {
			const zooms: number[] = [];
			const map: CrewMapProjector = {
				project: (latlng, zoom = 1) => {
					zooms.push(zoom);
					return fakeMap.project(latlng, zoom);
				},
			};

			clusterCrewLocations([loc('a', 0, 0), loc('b', 0, 1)], map, 7);

			expect(zooms).toEqual([7, 7]);
		});
	});

	describe('linkage chains', () => {
		it('collapses a chain of nearby crew transitively', () => {
			const step = CREW_CLUSTER_PIXELS - 1;
			const clusters = clusterCrewLocations(
				[loc('a', 0, 0), loc('b', 0, step), loc('c', 0, 2 * step)],
				fakeMap,
				1,
			);
			expect(clusters).toHaveLength(1);
			expect(clusters[0].members.map((m) => m.userId).sort()).toEqual([
				'a',
				'b',
				'c',
			]);
		});

		it('does not link a broken chain when adjacent pairs exceed the radius', () => {
			const step = CREW_CLUSTER_PIXELS + 1;
			expect(
				clusterUserIds([
					loc('a', 0, 0),
					loc('b', 0, step),
					loc('c', 0, 2 * step),
				]),
			).toEqual([['a'], ['b'], ['c']]);
		});

		it('merges a collinear triple when end-to-end span equals the radius', () => {
			const step = CREW_CLUSTER_PIXELS;
			expect(
				clusterUserIds([
					loc('a', 0, 0),
					loc('b', 0, step / 2),
					loc('c', 0, step),
				]),
			).toEqual([['a', 'b', 'c']]);
		});
	});

	describe('malformed and extreme inputs', () => {
		it('returns NaN centroid for NaN coordinates without throwing', () => {
			const clusters = clusterCrewLocations(
				[loc('a', Number.NaN, Number.NaN)],
				fakeMap,
				1,
			);
			expect(clusters).toHaveLength(1);
			expect(clusters[0].latitude).toBeNaN();
			expect(clusters[0].longitude).toBeNaN();
		});

		it('does not cluster points whose projected distance is NaN', () => {
			expect(
				clusterUserIds([
					loc('a', Number.NaN, 0),
					loc('b', 0, Number.NaN),
				]),
			).toEqual([['a'], ['b']]);
		});

		it('handles infinite coordinates without throwing', () => {
			const clusters = clusterCrewLocations(
				[loc('a', Number.POSITIVE_INFINITY, 0), loc('b', 0, 0)],
				fakeMap,
				1,
			);
			expect(clusters).toHaveLength(2);
			expect(clusters.every((c) => c.members.length === 1)).toBe(true);
		});

		it('keeps duplicate userId entries at different coordinates in the partition', () => {
			const first = loc('dup', 0, 0);
			const second = loc('dup', 0, 1000);
			const clusters = clusterCrewLocations([first, second], fakeMap, 1);

			expect(clusters).toHaveLength(2);
			expectPartition([first, second], clusters);
		});

		it('propagates errors from map.project', () => {
			const map: CrewMapProjector = {
				project: () => {
					throw new Error('project failed');
				},
			};
			expect(() =>
				clusterCrewLocations([loc('a', 0, 0)], map, 1),
			).toThrow('project failed');
		});
	});
});
