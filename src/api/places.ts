import { apiFetch, expectOk } from './client';

export interface PlaceSuggestion {
	placeId: string;
	label: string;
}

export interface PlaceDetails {
	placeId: string;
	latitude: number;
	longitude: number;
	formattedAddress: string;
	formattedStreetLine?: string;
	displayName: string | null;
}

export async function autocompletePlaces(
	input: string,
	sessionToken?: string,
	signal?: AbortSignal,
): Promise<PlaceSuggestion[]> {
	const res = await apiFetch('/api/places/autocomplete', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ input, sessionToken }),
		signal,
	});
	const data = await expectOk<{ suggestions?: PlaceSuggestion[] }>(
		res,
		'Places autocomplete failed',
	);
	return data.suggestions ?? [];
}

export async function getPlaceDetails(
	placeId: string,
	sessionToken?: string,
	signal?: AbortSignal,
): Promise<PlaceDetails> {
	const res = await apiFetch('/api/places/details', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ placeId, sessionToken }),
		signal,
	});
	return expectOk<PlaceDetails>(res, 'Place details failed');
}

export interface ViewportHint {
	latitude: number | null;
	longitude: number | null;
	googlePlaceId: string | null;
	formattedAddress: string | null;
	formattedStreetLine: string | null;
	displayName: string | null;
}

export async function fetchViewportHint(
	input: {
		addressName?: string;
		streetLine?: string;
		building?: string;
	},
	signal?: AbortSignal,
): Promise<ViewportHint> {
	const res = await apiFetch('/api/places/viewport-hint', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(input),
		signal,
	});
	return expectOk(res, 'Viewport hint failed');
}
