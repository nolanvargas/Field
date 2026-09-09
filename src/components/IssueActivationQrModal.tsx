import { useEffect, useState } from 'react';
import {
	Button,
	Center,
	Image,
	Loader,
	Stack,
	Text,
} from '@mantine/core';
import QRCode from 'qrcode';
import {
	issueMobileActivation,
	type AppUser,
	type MobileActivation,
} from '../api/users';
import { KeyboardAwareModal } from './KeyboardAwareModal';
import { RelativeTime } from './RelativeTime';
import { useCurrentUser } from '../context/CurrentUserContext';
import { notifyError } from '../notify';

type IssueActivationQrModalProps = {
	user: AppUser | null;
	opened: boolean;
	onClose: () => void;
};

export function IssueActivationQrModal({
	user,
	opened,
	onClose,
}: IssueActivationQrModalProps) {
	const { user: currentUser, webSsoMode } = useCurrentUser();
	const [loading, setLoading] = useState(false);
	const [activation, setActivation] = useState<MobileActivation | null>(null);
	const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

	useEffect(() => {
		if (!opened || !user) {
			setActivation(null);
			setQrDataUrl(null);
			setLoading(false);
			return;
		}

		const controller = new AbortController();
		setLoading(true);
		setActivation(null);
		setQrDataUrl(null);

		void issueMobileActivation(user.id, {
			createdByUserId: webSsoMode ? undefined : (currentUser?.id ?? undefined),
			signal: controller.signal,
		})
			.then(async (result) => {
				if (controller.signal.aborted) return;
				setActivation(result);
				const dataUrl = await QRCode.toDataURL(result.code, {
					errorCorrectionLevel: 'M',
					margin: 2,
					width: 280,
				});
				if (!controller.signal.aborted) setQrDataUrl(dataUrl);
			})
			.catch((err: unknown) => {
				if (
					(err instanceof DOMException || err instanceof Error) &&
					err.name === 'AbortError'
				) {
					return;
				}
				notifyError(
					err instanceof Error ? err.message : 'Failed to issue activation QR',
				);
			})
			.finally(() => {
				if (!controller.signal.aborted) setLoading(false);
			});

		return () => controller.abort();
	}, [opened, user, currentUser?.id, webSsoMode]);

	return (
		<KeyboardAwareModal
			opened={opened}
			onClose={onClose}
			title={user ? `Activate ${user.displayName}` : 'Activation QR'}
			centered
		>
			{loading ? (
				<Center py='xl'>
					<Loader size='sm' />
				</Center>
			) : null}

			{activation && qrDataUrl ? (
				<Stack align='center' gap='sm'>
					<Image
						src={qrDataUrl}
						alt='Mobile activation QR code'
						w={280}
						h={280}
						fit='contain'
					/>
					<Text size='sm' c='dimmed' ta='center'>
						Single-use code. Expires{' '}
						<RelativeTime
							value={activation.expiresAt}
							variant='absolute'
						/>
						.
						Show this QR once — it cannot be retrieved again.
					</Text>
					<Text
						size='xs'
						ff='monospace'
						c='dimmed'
						ta='center'
						style={{ wordBreak: 'break-all' }}
					>
						{activation.code}
					</Text>
					<Button onClick={onClose} color='brand' fullWidth mt='sm'>
						Done
					</Button>
				</Stack>
			) : null}
		</KeyboardAwareModal>
	);
}
