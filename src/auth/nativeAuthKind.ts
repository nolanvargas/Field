import { Capacitor } from '@capacitor/core';
import { useMediaQuery } from '@mantine/hooks';
import { AG_GRID_MOBILE_MQ } from '../agGridDefaults';
import { useCurrentUser } from '../context/CurrentUserContext';

export type NativeAuthKind = 'idp' | 'device' | null;

/** Active native auth kind (null on web). */
export function useNativeAuthKind(): NativeAuthKind {
	const { nativeAuthMode } = useCurrentUser();
	if (!Capacitor.isNativePlatform()) return null;
	return nativeAuthMode;
}

/** IdP JWT path — same API/UI capabilities as desktop web (even on a phone). */
export function useNativeIdpMode(): boolean {
	return useNativeAuthKind() === 'idp';
}

/**
 * Use compact phone task UI only when viewport is narrow and not native IdP.
 * Native IdP keeps coordinator tools (New Task, modals, admin pages).
 */
export function useCompactMobileTaskUi(): boolean {
	const isNarrow = useMediaQuery(AG_GRID_MOBILE_MQ, true, {
		getInitialValueInEffect: false,
	});
	const idpMode = useNativeIdpMode();
	if (Capacitor.isNativePlatform() && idpMode) return false;
	return Boolean(isNarrow);
}

/** Block admin surfaces that require IdP (Users, Crew map) when on QR device session. */
export function useNativeAdminCapable(): boolean {
	const kind = useNativeAuthKind();
	if (!Capacitor.isNativePlatform()) return true;
	return kind === 'idp';
}

/** @deprecated alias */
export function useCoordinatorLayout(): boolean {
	return !useCompactMobileTaskUi();
}
