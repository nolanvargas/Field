import { useRef, type ReactElement } from 'react';
import { Box } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { useLocation, useOutlet } from 'react-router-dom';
import { AG_GRID_MOBILE_MQ } from '../agGridDefaults';
import { useCurrentUser } from '../context/CurrentUserContext';
import {
	getMobileCacheKey,
	isMobileOverlayRoute,
} from '../mobilePageCache';

/**
 * On mobile, keep main tab pages mounted while switching tabs or opening a task
 * so scroll position, filters, and open modals are preserved.
 */
export function MobilePersistentOutlet() {
	const outlet = useOutlet();
	const location = useLocation();
	const { user } = useCurrentUser();
	const isMobile = useMediaQuery(AG_GRID_MOBILE_MQ, true, {
		getInitialValueInEffect: false,
	});
	const cacheRef = useRef<Map<string, ReactElement>>(new Map());
	const userIdRef = useRef(user?.id);

	if (userIdRef.current !== user?.id) {
		cacheRef.current.clear();
		userIdRef.current = user?.id;
	}

	if (!isMobile) {
		return outlet;
	}

	const cacheKey = getMobileCacheKey(location.pathname);
	const overlay = isMobileOverlayRoute(location.pathname);
	const activeCacheKey = overlay ? null : cacheKey;

	// Keep cache fresh while a tab is active; hidden slots stay mounted for state.
	if (cacheKey && outlet && !overlay) {
		cacheRef.current.set(cacheKey, outlet);
	}

	return (
		<>
			{[...cacheRef.current.entries()].map(([key, element]) => (
				<Box
					key={key}
					className='mobile-page-cache-slot'
					hidden={key !== activeCacheKey}
				>
					{element}
				</Box>
			))}
			{overlay ? outlet : null}
			{!overlay &&
			activeCacheKey &&
			!cacheRef.current.has(activeCacheKey) &&
			outlet ? (
				<Box className='mobile-page-cache-slot'>{outlet}</Box>
			) : null}
		</>
	);
}
