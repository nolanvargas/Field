import type { CrewLocation } from '../api/crewLocations';

/**
 * Marker centers closer than this (in screen pixels at the current zoom) are
 * grouped into a single +N bubble. Crew circles are 36px wide, so 40px catches
 * overlapping markers while keeping adjacent-but-distinct ones apart.
 */
export const CREW_CLUSTER_PIXELS = 40;

export interface CrewCluster {
	members: CrewLocation[];
	latitude: number;
	longitude: number;
}

/**
 * Minimal shape of the map we need for clustering (only `project` is used, so
 * it's easy to fake in tests).
 */
export interface CrewMapProjector {
	project(
		latlng: [number, number],
		zoom?: number,
	): { x: number; y: number };
}

/**
 * Single-linkage clustering of crew locations whose marker centers fall within
 * CREW_CLUSTER_PIXELS of another group member at the given zoom, so a chain of
 * nearby crew members collapses into one bubble. Recomputed on zoom change so
 * bubbles stay distinct when zoomed in and group up when zoomed out.
 */
export function clusterCrewLocations(
	locations: CrewLocation[],
	map: CrewMapProjector,
	zoom: number,
): CrewCluster[] {
	const points = locations.map((loc) => {
		const p = map.project([loc.latitude, loc.longitude], zoom);
		return { loc, x: p.x, y: p.y, cluster: -1 };
	});

	const radiusSq = CREW_CLUSTER_PIXELS * CREW_CLUSTER_PIXELS;
	const clusters: CrewCluster[] = [];
	let clusterId = 0;

	for (let i = 0; i < points.length; i++) {
		if (points[i].cluster !== -1) continue;

		const members = [points[i].loc];
		points[i].cluster = clusterId;
		const queue = [i];

		while (queue.length > 0) {
			const j = queue.pop()!;
			for (let k = 0; k < points.length; k++) {
				if (points[k].cluster !== -1) continue;
				const dx = points[j].x - points[k].x;
				const dy = points[j].y - points[k].y;
				if (dx * dx + dy * dy <= radiusSq) {
					points[k].cluster = clusterId;
					members.push(points[k].loc);
					queue.push(k);
				}
			}
		}

		let latSum = 0;
		let lngSum = 0;
		for (const member of members) {
			latSum += member.latitude;
			lngSum += member.longitude;
		}
		clusters.push({
			members,
			latitude: latSum / members.length,
			longitude: lngSum / members.length,
		});
		clusterId++;
	}

	return clusters;
}
