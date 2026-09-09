import { apiFetch, expectOk } from './client';

export type CrewLocationEventType = 'started' | 'ended';

export interface CrewLocation {
	userId: string;
	displayName: string;
	eventType: CrewLocationEventType;
	latitude: number;
	longitude: number;
	accuracyMeters: number | null;
	recordedAt: string;
	taskId: number;
	taskType: string;
	externalKey: string;
	jobTitle: string;
	destinationAddress: string;
}

export async function listCrewLocations(opts?: {
	actorUserId?: string;
	signal?: AbortSignal;
}): Promise<CrewLocation[]> {
	const params = new URLSearchParams();
	if (opts?.actorUserId) params.set('actorUserId', opts.actorUserId);
	const qs = params.toString();
	const res = await apiFetch(`/api/crew-locations${qs ? `?${qs}` : ''}`, {
		signal: opts?.signal,
	});
	const data = await expectOk<{ locations?: CrewLocation[] }>(
		res,
		'Crew locations failed',
	);
	return data.locations ?? [];
}
