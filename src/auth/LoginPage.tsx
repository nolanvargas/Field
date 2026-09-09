import { Button, Center, Stack, Text, Title } from '@mantine/core';
import { useMsal } from '@azure/msal-react';
import { InteractionStatus } from '@azure/msal-browser';
import { BrandLogo } from '../components/BrandLogo';
import { ProductLinks } from '../components/ProductLinks';
import { useDocumentTitle } from '../documentTitle';
import { loginRequest } from './msalConfig';

export function LoginPage() {
	const { instance, inProgress } = useMsal();
	const busy = inProgress !== InteractionStatus.None;
	useDocumentTitle('Sign in');

	const onSignIn = () => {
		void instance.loginRedirect(loginRequest);
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
						Sign in with your organization account to manage tasks.
					</Text>
				</Stack>
				<Button
					size='md'
					color='brand'
					onClick={onSignIn}
					loading={busy}
					disabled={busy}
				>
					Sign in with Microsoft
				</Button>
				<ProductLinks variant='auth-footer' />
			</Stack>
		</Center>
	);
}
