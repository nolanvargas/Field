import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { useMsal } from '@azure/msal-react';
import { setAccessTokenProvider } from '../api/client';
import { acquireIdToken } from './token';
import { getNativeAuthMode, subscribeNativeAuthMode } from './nativeAuthMode';
import { startNativeEntraRedirectListener } from './nativeEntraRedirect';
import { getMsalInstance } from './msalConfig';

/** MSAL redirect deep links on Capacitor. */
export function NativeEntraRedirectHandler() {
	const { instance } = useMsal();

	useEffect(() => {
		if (!Capacitor.isNativePlatform()) return;
		return startNativeEntraRedirectListener(instance);
	}, [instance]);

	return null;
}

/** Wire API Bearer from Entra when native auth mode is IdP. */
export function NativeEntraTokenBridge() {
	const { instance, accounts } = useMsal();

	useEffect(() => {
		if (!Capacitor.isNativePlatform()) return;

		const syncProvider = () => {
			if (getNativeAuthMode() !== 'idp') {
				setAccessTokenProvider(null);
				return;
			}
			const account = instance.getActiveAccount() ?? accounts[0] ?? null;
			if (!account) {
				setAccessTokenProvider(null);
				return;
			}
			if (!instance.getActiveAccount()) {
				instance.setActiveAccount(account);
			}
			setAccessTokenProvider(async () => {
				const active =
					instance.getActiveAccount() ?? instance.getAllAccounts()[0];
				if (!active) return null;
				return acquireIdToken(instance, active);
			});
		};

		syncProvider();
		return subscribeNativeAuthMode(syncProvider);
	}, [instance, accounts]);

	return null;
}

/** Initialize MSAL on native when Entra is configured. */
export function useNativeMsalInit(
	onReady: () => void,
	onError: (msg: string) => void,
) {
	useEffect(() => {
		if (!Capacitor.isNativePlatform()) return;

		let cancelled = false;
		const instance = getMsalInstance();

		void instance
			.initialize()
			.then(() => instance.handleRedirectPromise())
			.then((result) => {
				if (cancelled) return;
				if (result?.account) {
					instance.setActiveAccount(result.account);
				} else if (!instance.getActiveAccount()) {
					const existing = instance.getAllAccounts()[0];
					if (existing) instance.setActiveAccount(existing);
				}
				onReady();
			})
			.catch((err: unknown) => {
				if (cancelled) return;
				onError(err instanceof Error ? err.message : 'MSAL init failed');
			});

		return () => {
			cancelled = true;
		};
	}, [onReady, onError]);
}
