import { Capacitor } from '@capacitor/core';
import { getMsalInstance } from './msalConfig';
import { setNativeAuthMode } from './nativeAuthMode';
import { setAccessTokenProvider } from '../api/client';

/** Drop IdP mode and MSAL cache (switch to QR or sign-out). */
export async function clearNativeIdpSession(): Promise<void> {
	if (!Capacitor.isNativePlatform()) return;

	setAccessTokenProvider(null);
	await setNativeAuthMode(null);

	try {
		const instance = getMsalInstance();
		const account =
			instance.getActiveAccount() ?? instance.getAllAccounts()[0] ?? null;
		if (account) {
			await instance.clearCache({ account });
		} else {
			await instance.clearCache();
		}
	} catch {
		// Entra may not be configured in dev — ignore.
	}
}
