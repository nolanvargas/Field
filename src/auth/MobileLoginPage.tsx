import { useRef, useState } from 'react';
import {
	Button,
	Center,
	Divider,
	Stack,
	Text,
	TextInput,
	Title,
} from '@mantine/core';
import { LogIn, QrCode } from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';
import { ProductLinks } from '../components/ProductLinks';
import { useCurrentUser } from '../context/CurrentUserContext';
import { useDocumentTitle } from '../documentTitle';
import {
	activateFromQrScan,
	activateWithCode,
	canScanActivationQr,
} from './activateFromQr';
import {
	getActiveWebAuthProvider,
	isWebAuthEnabled,
} from './webAuthConfig';
import { WEB_AUTH_PROVIDER_ENTRA } from '../../shared/webAuthProviders.js';
import { clearMobileSession } from './mobileSession';
import { clearNativeIdpSession } from './clearNativeIdp';
import { setNativeAuthMode } from './nativeAuthMode';
import { loginRequest } from './msalConfig';
import { notifyError } from '../notify';

function canNativeIdpSignIn(): boolean {
	return (
		isWebAuthEnabled() &&
		getActiveWebAuthProvider() === WEB_AUTH_PROVIDER_ENTRA
	);
}

/** Native gate — sign in with work account or activate with QR. */
export function MobileLoginPage() {
	const { refreshAfterMobileActivation } = useCurrentUser();
	const [code, setCode] = useState('');
	const [busy, setBusy] = useState(false);
	const busyRef = useRef(false);
	const showScan = canScanActivationQr();
	const showIdp = canNativeIdpSignIn();
	useDocumentTitle('Sign in');

	const finish = async (fn: () => Promise<unknown>) => {
		if (busyRef.current) return;
		busyRef.current = true;
		setBusy(true);
		try {
			await fn();
			await refreshAfterMobileActivation();
		} catch (err: unknown) {
			notifyError(
				err instanceof Error ? err.message : 'Failed to activate this device',
			);
		} finally {
			busyRef.current = false;
			setBusy(false);
		}
	};

	const signInWithWorkAccount = async () => {
		if (busyRef.current) return;
		busyRef.current = true;
		setBusy(true);
		try {
			await clearMobileSession();
			await setNativeAuthMode('idp');
			const { getMsalInstance } = await import('./msalConfig');
			const instance = getMsalInstance();
			await instance.loginRedirect(loginRequest);
		} catch (err: unknown) {
			await clearNativeIdpSession();
			notifyError(
				err instanceof Error ? err.message : 'Could not start sign-in',
			);
		} finally {
			busyRef.current = false;
			setBusy(false);
		}
	};

	return (
		<Center w='100%' px='md' className='field-auth-bg'>
			<Stack gap='lg' maw={400} w='100%' align='stretch' className='field-auth-stack'>
				<Stack gap={6} align='flex-start'>
					<BrandLogo size={72} />
					<Title
						order={1}
						fz='2.75rem'
						fw={700}
						style={{
							fontFamily: 'var(--font-display)',
							letterSpacing: '-0.03em',
							color: 'var(--color-text)',
						}}
					>
						Field
					</Title>
					<Text c='dimmed' size='sm'>
						Sign in with your organization account, or activate this device for
						crew work with a field1.… code.
					</Text>
				</Stack>

				{showIdp ? (
					<Button
						size='md'
						color='brand'
						leftSection={<LogIn size={18} />}
						onClick={() => void signInWithWorkAccount()}
						loading={busy}
						disabled={busy}
					>
						Sign in with work account
					</Button>
				) : null}

				{showIdp ? (
					<Divider label='Crew activation' labelPosition='center' />
				) : null}

				<TextInput
					label='Activation code'
					placeholder='field1.…'
					value={code}
					onChange={(e) => setCode(e.currentTarget.value)}
					disabled={busy}
					autoCapitalize='off'
					autoCorrect='off'
					spellCheck={false}
					onKeyDown={(e) => {
						if (e.key === 'Enter') {
							e.preventDefault();
							void finish(() => activateWithCode(code));
						}
					}}
				/>
				<Button
					size='md'
					variant={showIdp ? 'light' : 'filled'}
					color='brand'
					onClick={() => void finish(() => activateWithCode(code))}
					loading={busy}
					disabled={busy || !code.trim()}
				>
					Activate device
				</Button>
				{showScan ? (
					<Button
						size='md'
						variant='light'
						color='brand'
						leftSection={<QrCode size={18} />}
						onClick={() => void finish(() => activateFromQrScan())}
						loading={busy}
						disabled={busy}
					>
						Scan activation QR
					</Button>
				) : null}
				<ProductLinks variant='auth-footer' />
			</Stack>
		</Center>
	);
}
