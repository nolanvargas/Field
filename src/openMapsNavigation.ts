import { Capacitor } from '@capacitor/core';

export interface MapCoords {
	latitude: number;
	longitude: number;
}

/** Open the device maps app using stored coordinates only. */
export function openMapsNavigationCoords(coords: MapCoords): void {
	const { latitude, longitude } = coords;
	if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

	const destination = `${latitude},${longitude}`;
	const platform = Capacitor.getPlatform();

	let url: string;
	if (platform === 'ios') {
		url = `maps://?daddr=${encodeURIComponent(destination)}`;
	} else if (platform === 'android') {
		url = `geo:0,0?q=${encodeURIComponent(destination)}`;
	} else {
		url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
	}

	openMapsUrl(url);
}

/** Open a pre-built multistop route URL (from POST /api/routes/optimize). */
export function openOptimizedRoute(mapsUrl: string): void {
	const url = mapsUrl.trim();
	if (!url) return;
	openMapsUrl(url);
}

export function mapsPlatform(): 'ios' | 'android' | 'web' {
	const platform = Capacitor.getPlatform();
	if (platform === 'ios' || platform === 'android') return platform;
	return 'web';
}

function openMapsUrl(url: string): void {
	if (mapsPlatform() === 'web') {
		window.open(url, '_blank', 'noopener,noreferrer');
		return;
	}
	window.location.assign(url);
}

export { hasDestinationCoords } from '../shared/destinationCoords.js';
