import { useState } from 'react';
import {
	Button,
	Center,
	Stack,
	Text,
	TextInput,
	Title,
} from '@mantine/core';
import { QrCode } from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';
import { ProductLinks } from '../components/ProductLinks';
import { useCurrentUser } from '../context/CurrentUserContext';
import { useDocumentTitle } from '../documentTitle';
import {
	activateFromQrScan,
	activateWithCode,
	canScanActivationQr,
} from './activateFromQr';
import { notifyError } from '../notify';

/** Native gate when no device session — same chrome as web LoginPage. */
export function MobileLoginPage() {
	const { refreshAfterMobileActivation } = useCurrentUser();
	const [code, setCode] = useState('');
	const [busy, setBusy] = useState(false);
	const showScan = canScanActivationQr();
	useDocumentTitle('Activate');

	const finish = async (fn: () => Promise<unknown>) => {
		setBusy(true);
		try {
			await fn();
			await refreshAfterMobileActivation();
		} catch (err: unknown) {
			notifyError(
				err instanceof Error ? err.message : 'Failed to activate this device',
			);
		} finally {
			setBusy(false);
		}
	};

	return (
		<Center mih='100dvh' px='md' className='field-auth-bg'>
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
						{showScan
							? 'Scan your activation QR, or paste the field1.… code.'
							: 'Paste the field1.… activation code from the desktop Users page.'}
					</Text>
				</Stack>
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
					color='brand'
					onClick={() => void finish(() => activateWithCode(code))}
					loading={busy}
					disabled={busy || !code.trim()}
				>
					Activate
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
