import { apiFetch, expectOk } from './client';

export interface RouteOptimizeSkipped {
	taskId: number;
	reason: string;
}

export interface RouteOptimizeResult {
	orderedTaskIds: number[];
	mapsUrl: string;
	skipped: RouteOptimizeSkipped[];
}

export async function optimizeRoute(
	taskIds: number[],
	platform: 'ios' | 'android' | 'web',
	signal?: AbortSignal,
): Promise<RouteOptimizeResult> {
	const res = await apiFetch('/api/routes/optimize', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ taskIds, platform }),
		signal,
	});
	return expectOk<RouteOptimizeResult>(res, 'Route optimization failed');
}
