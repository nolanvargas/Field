import { Button, Text, Stack } from '@mantine/core';
import { useMsal } from '@azure/msal-react';
import { Capacitor } from '@capacitor/core';
import { isWebAuthEnabled } from './config';
import { getNativeAuthMode } from './nativeAuthMode';
import { clearNativeIdpSession } from './clearNativeIdp';
import { NATIVE_ENTRA_REDIRECT_URI } from './msalConfig';

type EntraSignedInProps = {
	/** Light surface (settings page) vs dark (sidebar — legacy). */
	variant?: 'dark' | 'light';
};

/** Web or native IdP identity (Entra module today). */
export function EntraSignedIn({ variant = 'dark' }: EntraSignedInProps) {
	const { instance, accounts } = useMsal();
	const account = instance.getActiveAccount() ?? accounts[0];
	const name =
		account?.name ?? account?.username ?? 'Signed in';

	const onSignOut = () => {
		if (Capacitor.isNativePlatform()) {
			void clearNativeIdpSession();
			return;
		}
		void instance.logoutRedirect({
			account: account ?? undefined,
			postLogoutRedirectUri: window.location.origin,
		});
	};

	const isLight = variant === 'light';

	return (
		<Stack gap={8}>
			<Text
				size='sm'
				c={isLight ? undefined : 'var(--color-text-on-dark)'}
				lineClamp={2}
			>
				{name}
			</Text>
			<Button
				size='xs'
				variant='subtle'
				color='gray'
				onClick={onSignOut}
				styles={
					isLight
						? { root: { justifyContent: 'flex-start', alignSelf: 'flex-start' } }
						: {
								root: {
									color: 'var(--color-text-on-dark-muted)',
									justifyContent: 'flex-start',
								},
							}
				}
			>
				Sign out
			</Button>
		</Stack>
	);
}

export function showWebSsoSignedIn(): boolean {
	if (!isWebAuthEnabled()) return false;
	if (!Capacitor.isNativePlatform()) return true;
	return getNativeAuthMode() === 'idp';
}

/** Post-logout redirect for native Entra (unused when sign-out clears cache locally). */
export function entraPostLogoutRedirectUri(): string {
	if (Capacitor.isNativePlatform()) return NATIVE_ENTRA_REDIRECT_URI;
	return typeof window !== 'undefined'
		? window.location.origin
		: 'http://localhost:5173';
}
