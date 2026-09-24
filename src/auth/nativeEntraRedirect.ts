import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import type { PublicClientApplication } from '@azure/msal-browser';
import { NATIVE_ENTRA_REDIRECT_URI } from './msalConfig';

/** Handle Entra redirect returning via custom URL scheme on Capacitor. */
export function startNativeEntraRedirectListener(
	instance: PublicClientApplication,
): () => void {
	if (!Capacitor.isNativePlatform()) return () => {};

	let removed = false;
	const pending = App.addListener('appUrlOpen', (event) => {
		if (removed) return;
		const url = event.url ?? '';
		if (!url.startsWith(NATIVE_ENTRA_REDIRECT_URI)) return;
		void instance.handleRedirectPromise(url);
	});

	return () => {
		removed = true;
		void pending.then((handle) => handle.remove());
	};
}
