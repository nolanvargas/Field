import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { subscribeMobileSession } from '../auth/mobileSession';
import { startMobilePushRegistration } from './mobilePush';

/** Registers FCM when a native device session is active. */
export function MobilePushRegistration() {
	useEffect(() => {
		if (!Capacitor.isNativePlatform()) return;

		const unsubscribe = subscribeMobileSession((session) => {
			if (session) void startMobilePushRegistration();
		});

		return unsubscribe;
	}, []);

	return null;
}
