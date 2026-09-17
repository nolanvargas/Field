export const COMPACT_NAV_RAIL_PX = 64;
export const COMPACT_NAV_DRAWER_PX = 240;
export const COMPACT_NAV_WIDE_MQ = '(min-width: 1281px)';
export const COMPACT_NAV_DESKTOP_MQ = '(min-width: 48em)';

export function matchesCompactNavWideMq(): boolean {
	if (typeof window === 'undefined') return false;
	return window.matchMedia(COMPACT_NAV_WIDE_MQ).matches;
}

const STORAGE_KEY = 'field.compactNavOpen';

export function readCompactNavOpen(): boolean | null {
	try {
		const value = sessionStorage.getItem(STORAGE_KEY);
		if (value === '1') return true;
		if (value === '0') return false;
	} catch {
		/* ignore */
	}
	return null;
}

export function writeCompactNavOpen(open: boolean): void {
	try {
		sessionStorage.setItem(STORAGE_KEY, open ? '1' : '0');
	} catch {
		/* ignore */
	}
}

/** First visit: closed at ≤1280px; expanded (push drawer) above 1280px. */
export function initialCompactNavOpen(): boolean {
	const stored = readCompactNavOpen();
	if (stored !== null) return stored;
	if (typeof window === 'undefined') return false;
	return window.matchMedia(COMPACT_NAV_WIDE_MQ).matches;
}
