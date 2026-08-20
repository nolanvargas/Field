import { describe, expect, it } from 'vitest'
import type { CrewLocation } from '../src/api/crewLocations'
import {
	CREW_CLUSTER_PIXELS,
	clusterCrewLocations,
	type CrewMapProjector,
} from '../src/pages/crewClustering'

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
	}
}

/** Fake map: pixels scale linearly with zoom, so distances act like a plane. */
const fakeMap: CrewMapProjector = {
	project: ([lat, lng], zoom = 1) => ({ x: lng * zoom, y: lat * zoom }),
}

describe('clusterCrewLocations', () => {
	it('keeps far-apart crew in separate single-member clusters', () => {
		const clusters = clusterCrewLocations(
			[loc('a', 0, 0), loc('b', 0, 1000)],
			fakeMap,
			1,
		)
		expect(clusters).toHaveLength(2)
		expect(clusters.every((c) => c.members.length === 1)).toBe(true)
	})

	it('groups overlapping crew into one cluster with all members', () => {
		const clusters = clusterCrewLocations(
			[loc('a', 0, 0), loc('b', 0, 0.0001), loc('c', 0.0001, 0)],
			fakeMap,
			1,
		)
		expect(clusters).toHaveLength(1)
		expect(clusters[0].members.map((m) => m.userId).sort()).toEqual(['a', 'b', 'c'])
	})

	it('places the group bubble at the centroid', () => {
		const clusters = clusterCrewLocations(
			[loc('a', 0, 0), loc('b', 10, 0)],
			fakeMap,
			1,
		)
		expect(clusters).toHaveLength(1)
		expect(clusters[0].latitude).toBeCloseTo(5)
		expect(clusters[0].longitude).toBeCloseTo(0)
	})

	it('groups points exactly at the cluster radius', () => {
		const clusters = clusterCrewLocations(
			[loc('a', 0, 0), loc('b', 0, CREW_CLUSTER_PIXELS)],
			fakeMap,
			1,
		)
		expect(clusters).toHaveLength(1)
	})

	it('collapses a chain of nearby crew transitively', () => {
		const step = CREW_CLUSTER_PIXELS - 1
		const clusters = clusterCrewLocations(
			[loc('a', 0, 0), loc('b', 0, step), loc('c', 0, 2 * step)],
			fakeMap,
			1,
		)
		expect(clusters).toHaveLength(1)
		expect(clusters[0].members.map((m) => m.userId).sort()).toEqual(['a', 'b', 'c'])
	})

	it('merges crew when zoomed out and splits them when zoomed in', () => {
		const crew = [loc('a', 0, 0), loc('b', 0, 50)]
		expect(clusterCrewLocations(crew, fakeMap, 1)).toHaveLength(2)
		expect(clusterCrewLocations(crew, fakeMap, 0.5)).toHaveLength(1)
	})

	it('returns no clusters for no locations', () => {
		expect(clusterCrewLocations([], fakeMap, 1)).toEqual([])
	})
})
