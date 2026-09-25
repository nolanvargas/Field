import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Center, Loader } from '@mantine/core';
import { Capacitor } from '@capacitor/core';
import { ConnectivityBanner } from '../components/ConnectivityBanner';
import { InteractionStatus } from '@azure/msal-browser';
import { useMsal } from '@azure/msal-react';
import { useCurrentUser } from '../context/CurrentUserContext';
import { MobileLoginPage } from './MobileLoginPage';
import { acquireIdToken } from './token';

function MobileIdpAuthGate({ children }: { children: ReactNode }) {
	const { instance, accounts, inProgress } = useMsal();
	const { refreshAfterIdpSignIn } = useCurrentUser();
	const [ready, setReady] = useState(false);

	useEffect(() => {
		if (inProgress !== InteractionStatus.None) {
			setReady(false);
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
		void acquireIdToken(instance, account)
			.then(() => refreshAfterIdpSignIn())
			.then(() => {
				if (!cancelled) setReady(true);
			})
			.catch(() => {
				if (!cancelled) setReady(false);
			});

		return () => {
			cancelled = true;
		};
	}, [instance, accounts, inProgress, refreshAfterIdpSignIn]);

	if (
		inProgress === InteractionStatus.Startup ||
		inProgress === InteractionStatus.HandleRedirect
	) {
		return (
			<Center w='100%' px='md' className='field-auth-bg'>
				<Loader size='sm' />
			</Center>
		);
	}

	const account = instance.getActiveAccount() ?? accounts[0] ?? null;
	if (!account || !ready) {
		return <MobileLoginPage />;
	}

	return <>{children}</>;
}

function NativeConnectivityShell({ children }: { children: ReactNode }) {
	return (
		<>
			<ConnectivityBanner />
			{children}
		</>
	);
}

/**
 * Capacitor: require IdP sign-in or QR device session before the app shell.
 * Web: pass through (Entra / stub handled by AuthRoot).
 */
export function MobileAuthGate({ children }: { children: ReactNode }) {
	const isNative = Capacitor.isNativePlatform();
	const { loading, mobileSession, nativeAuthMode } = useCurrentUser();

	if (!isNative) {
		return <>{children}</>;
	}

	if (loading) {
		return (
			<NativeConnectivityShell>
				<Center w='100%' px='md' className='field-auth-bg'>
					<Loader size='sm' />
				</Center>
			</NativeConnectivityShell>
		);
	}

	if (nativeAuthMode === 'device' && mobileSession) {
		return <NativeConnectivityShell>{children}</NativeConnectivityShell>;
	}

	if (nativeAuthMode === 'idp') {
		return (
			<NativeConnectivityShell>
				<MobileIdpAuthGate>{children}</MobileIdpAuthGate>
			</NativeConnectivityShell>
		);
	}

	return (
		<NativeConnectivityShell>
			<MobileLoginPage />
		</NativeConnectivityShell>
	);
}
