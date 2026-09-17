import { Capacitor } from '@capacitor/core';

/** Client-only mock API for static demo builds (web). */
export function isDemoMode(): boolean {
	if (Capacitor.isNativePlatform()) return false;
	return import.meta.env.VITE_DEMO_MODE === 'true';
}
