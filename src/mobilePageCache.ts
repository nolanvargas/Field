import { matchPath } from 'react-router-dom';

/** Bottom-nav and common list pages whose React state should survive tab switches. */
const MOBILE_CACHE_PATHS = [
	'/my-tasks',
	'/tasks',
	'/contacts',
	'/addresses',
	'/more',
	'/settings',
	'/notifications',
	'/users',
	'/management',
	'/crew-map',
] as const;

const MOBILE_OVERLAY_PATTERNS = [
	'/task/:taskId',
	'/task/:taskId/complete',
	'/task/:taskId/deliver',
] as const;

export function getMobileCacheKey(pathname: string): string | null {
	if (
		MOBILE_CACHE_PATHS.includes(
			pathname as (typeof MOBILE_CACHE_PATHS)[number],
		)
	) {
		return pathname;
	}
	return null;
}

export function isMobileOverlayRoute(pathname: string): boolean {
	return MOBILE_OVERLAY_PATTERNS.some(
		(pattern) => matchPath(pattern, pathname) != null,
	);
}
