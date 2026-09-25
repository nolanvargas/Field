import { Box, Text } from '@mantine/core';
import { WifiOff } from 'lucide-react';
import { useFieldConnectivity } from '../hooks/useFieldConnectivity';

const COPY: Record<'offline' | 'unreachable', { title: string; detail: string }> =
	{
		offline: {
			title: "You're offline",
			detail:
				'Task data will not update until your device is back online. Anything you already opened may still be on screen.',
		},
		unreachable: {
			title: "Can't reach Field",
			detail:
				'Check your connection or VPN. We will keep trying when the network is available.',
		},
	};

export function ConnectivityBanner() {
	const { issue } = useFieldConnectivity();
	if (!issue) return null;

	const { title, detail } = COPY[issue];

	return (
		<Box
			className='field-connectivity-banner'
			role='status'
			aria-live='polite'
		>
			<WifiOff size={18} strokeWidth={2} aria-hidden />
			<Box className='field-connectivity-banner-text'>
				<Text size='sm' fw={600} component='span'>
					{title}
				</Text>
				<Text size='sm' component='span' c='dimmed'>
					{detail}
				</Text>
			</Box>
		</Box>
	);
}
