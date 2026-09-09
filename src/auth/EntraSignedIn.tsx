import { Button, Text, Stack } from '@mantine/core';
import { useMsal } from '@azure/msal-react';
import { Capacitor } from '@capacitor/core';
import { isWebAuthEnabled } from './config';

/** Sidebar identity when web SSO is active (Entra module today). */
export function EntraSignedIn() {
	const { instance, accounts } = useMsal();
	const account = instance.getActiveAccount() ?? accounts[0];
	const name =
		account?.name ?? account?.username ?? 'Signed in';

	const onSignOut = () => {
		void instance.logoutRedirect({
			account: account ?? undefined,
			postLogoutRedirectUri: window.location.origin,
		});
	};

	return (
		<Stack gap={8}>
			<Text size='sm' c='var(--color-text-on-dark)' lineClamp={2}>
				{name}
			</Text>
			<Button
				size='xs'
				variant='subtle'
				color='gray'
				onClick={onSignOut}
				styles={{
					root: { color: 'var(--color-text-on-dark-muted)', justifyContent: 'flex-start' },
				}}
			>
				Sign out
			</Button>
		</Stack>
	);
}

export function showWebSsoSignedIn(): boolean {
	return !Capacitor.isNativePlatform() && isWebAuthEnabled();
}
