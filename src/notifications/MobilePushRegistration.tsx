import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import {
	getMobileSession,
	subscribeMobileSession,
} from '../auth/mobileSession';
import {
	getNativeAuthMode,
	subscribeNativeAuthMode,
} from '../auth/nativeAuthMode';
import { startMobilePushRegistration } from './mobilePush';

/** Registers FCM when a native QR device session is active (not IdP mode). */
export function MobilePushRegistration() {
	useEffect(() => {
		if (!Capacitor.isNativePlatform()) return;

		const maybeStart = () => {
			if (getNativeAuthMode() !== 'device') return;
			if (getMobileSession()) void startMobilePushRegistration();
		};

		maybeStart();

		const unsubSession = subscribeMobileSession((session) => {
			if (session && getNativeAuthMode() === 'device') {
				void startMobilePushRegistration();
			}
		});
		const unsubMode = subscribeNativeAuthMode(maybeStart);

		return () => {
			unsubSession();
			unsubMode();
		};
	}, []);

	return null;
}
