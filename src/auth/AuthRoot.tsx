import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Center, Loader, Text } from '@mantine/core';
import { Capacitor } from '@capacitor/core';
import {
	AuthenticatedTemplate,
	MsalProvider,
	UnauthenticatedTemplate,
	useMsal,
} from '@azure/msal-react';
import { InteractionStatus } from '@azure/msal-browser';
import { setAccessTokenProvider } from '../api/client';
import {
	getActiveWebAuthProvider,
	isWebAuthEnabled,
	loadWebAuthConfig,
} from './webAuthConfig';
import { WEB_AUTH_PROVIDER_ENTRA } from '../../shared/webAuthProviders.js';
import { LoginPage } from './LoginPage';
import { getMsalInstance, loginRequest } from './msalConfig';
import { acquireIdToken, needsInteractiveLogin } from './token';
import {
	NativeEntraRedirectHandler,
	NativeEntraTokenBridge,
} from './NativeEntraShell';
import { setNativeAuthMode } from './nativeAuthMode';

function EntraTokenBridge({ children }: { children: ReactNode }) {
	const { instance, accounts, inProgress } = useMsal();
	const redirectStarted = useRef(false);

	useLayoutEffect(() => {
		const account = instance.getActiveAccount() ?? accounts[0] ?? null;
		if (account && !instance.getActiveAccount()) {
			instance.setActiveAccount(account);
		}

		setAccessTokenProvider(async () => {
			const active =
				instance.getActiveAccount() ?? instance.getAllAccounts()[0];
			if (!active) return null;
			try {
				return await acquireIdToken(instance, active);
			} catch (err) {
				console.error('[auth] silent token acquire failed', err);
				if (needsInteractiveLogin(err) && !redirectStarted.current) {
					redirectStarted.current = true;
					void instance.loginRedirect({
						...loginRequest,
						account: active,
					});
				}
				return null;
			}
		});

		return () => setAccessTokenProvider(null);
	}, [instance, accounts]);

	if (
		inProgress === InteractionStatus.Startup ||
		inProgress === InteractionStatus.HandleRedirect
	) {
		return (
			<Center mih='100dvh'>
				<Loader size='sm' />
			</Center>
		);
	}

	return <>{children}</>;
}

function EntraSessionReady({ children }: { children: ReactNode }) {
	const { instance, accounts, inProgress } = useMsal();
	const [ready, setReady] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const redirectStarted = useRef(false);

	useEffect(() => {
		if (inProgress !== InteractionStatus.None) {
			return;
		}

		const account = instance.getActiveAccount() ?? accounts[0] ?? null;
		if (!account) {
			setReady(false);
			return;
		}

		if (!instance.getActiveAccount()) {
			instance.setActiveAccount(account);
		}

		let cancelled = false;
		setReady(false);
		setError(null);

		void (async () => {
			try {
				await acquireIdToken(instance, account);
				if (!cancelled) setReady(true);
			} catch (err) {
				if (cancelled) return;
				if (needsInteractiveLogin(err)) {
					if (!redirectStarted.current) {
						redirectStarted.current = true;
						void instance.loginRedirect({
							...loginRequest,
							account,
						});
					}
					return;
				}
				console.error(err);
				setError(
					err instanceof Error
						? err.message
						: 'Could not refresh Microsoft sign-in',
				);
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [instance, accounts, inProgress]);

	if (error) {
		return (
			<Center mih='100dvh' px='md'>
				<Text c='red'>{error}</Text>
			</Center>
		);
	}

	if (!ready) {
		return (
			<Center mih='100dvh'>
				<Loader size='sm' />
			</Center>
		);
	}

	return <>{children}</>;
}

function EntraAuthGate({ children }: { children: ReactNode }) {
	return (
		<EntraTokenBridge>
			<AuthenticatedTemplate>
				<EntraSessionReady>{children}</EntraSessionReady>
			</AuthenticatedTemplate>
			<UnauthenticatedTemplate>
				<LoginPage />
			</UnauthenticatedTemplate>
		</EntraTokenBridge>
	);
}

/**
 * Web: load auth config, then MSAL gate or stub picker.
 * Native: MSAL shell when Entra configured (IdP mode); else QR-only.
 */
export function AuthRoot({ children }: { children: ReactNode }) {
	const isNative = Capacitor.isNativePlatform();
	const [configReady, setConfigReady] = useState(false);
	const [msalReady, setMsalReady] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const entraConfigured =
		configReady &&
		isWebAuthEnabled() &&
		getActiveWebAuthProvider() === WEB_AUTH_PROVIDER_ENTRA;

	const webSso = entraConfigured && !isNative;

	useEffect(() => {
		let cancelled = false;
		void loadWebAuthConfig()
			.then(() => {
				if (!cancelled) setConfigReady(true);
			})
			.catch((err: unknown) => {
				if (cancelled) return;
				console.error(err);
				setError(
					err instanceof Error ? err.message : 'Failed to load auth config',
				);
				setConfigReady(true);
			});

		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		if (!entraConfigured) {
			setMsalReady(true);
			return;
		}

		let cancelled = false;
		const instance = getMsalInstance();

		void instance
			.initialize()
			.then(() => instance.handleRedirectPromise())
			.then((result) => {
				if (cancelled) return;
				if (result?.account) {
					instance.setActiveAccount(result.account);
					if (isNative) {
						void setNativeAuthMode('idp');
					}
				} else if (!instance.getActiveAccount()) {
					const existing = instance.getAllAccounts()[0];
					if (existing) instance.setActiveAccount(existing);
				}
				setMsalReady(true);
			})
			.catch((err: unknown) => {
				if (cancelled) return;
				console.error(err);
				setError(err instanceof Error ? err.message : 'MSAL init failed');
				setMsalReady(true);
			});

		return () => {
			cancelled = true;
		};
	}, [entraConfigured]);

	if (!configReady || (entraConfigured && !msalReady)) {
		return (
			<Center mih='100dvh'>
				<Loader size='sm' />
			</Center>
		);
	}

	if (error) {
		return (
			<Center mih='100dvh' px='md'>
				<Text c='red'>{error}</Text>
			</Center>
		);
	}

	if (isNative) {
		if (!entraConfigured) {
			return <>{children}</>;
		}
		return (
			<MsalProvider instance={getMsalInstance()}>
				<NativeEntraRedirectHandler />
				<NativeEntraTokenBridge />
				{children}
			</MsalProvider>
		);
	}

	if (!webSso) {
		return <>{children}</>;
	}

	return (
		<MsalProvider instance={getMsalInstance()}>
			<EntraAuthGate>{children}</EntraAuthGate>
		</MsalProvider>
	);
}

