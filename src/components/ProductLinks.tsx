import {
	ActionIcon,
	Anchor,
	Box,
	Group,
	NavLink,
	Popover,
	Stack,
	Text,
} from '@mantine/core';
import { useLocation } from 'react-router-dom';
import { BookOpen, ChevronRight, Settings } from 'lucide-react';
import {
	getActionProductLinks,
	getAuthProductLinks,
	getLegalProductLinks,
	getVisibleProductLinks,
	type ProductLink,
} from '../productLinks';
import { FieldRouterNavLink } from './FieldRouterNavLink';

const SECTION_LABEL_STYLE = { letterSpacing: '0.04em' } as const;

type ProductLinksProps = {
	variant: 'sidebar' | 'stack' | 'auth-footer';
	permissions?: unknown;
};

function linkAnchorProps(link: ProductLink) {
	return link.external
		? { target: '_blank' as const, rel: 'noopener noreferrer' }
		: {};
}

function SidebarVariant({ permissions }: { permissions?: unknown }) {
	const location = useLocation();
	const helpLink = getActionProductLinks({ permissions }).find(
		(link) => link.id === 'help',
	);
	const legalLinks = getLegalProductLinks({ permissions });

	return (
		<Box className='field-product-links field-product-links--sidebar'>
			<Box className='field-nav-footer-actions' mb='xs'>
				<ActionIcon
					variant='subtle'
					className='field-nav-icon-btn'
					component={FieldRouterNavLink}
					to='/settings'
					aria-label='Settings'
					data-active={location.pathname === '/settings' || undefined}
				>
					<Settings size={18} aria-hidden />
				</ActionIcon>
				{helpLink ? (
					<ActionIcon
						variant='subtle'
						className='field-nav-icon-btn'
						component='a'
						href={helpLink.href}
						aria-label={helpLink.label}
						{...linkAnchorProps(helpLink)}
					>
						<BookOpen size={18} aria-hidden />
					</ActionIcon>
				) : null}
				{legalLinks.length > 0 ? (
					<Popover position='top-start' withinPortal>
						<Popover.Target>
							<ActionIcon
								variant='subtle'
								className='field-nav-icon-btn'
								aria-label='Legal'
							>
								<ChevronRight size={18} aria-hidden />
							</ActionIcon>
						</Popover.Target>
						<Popover.Dropdown p='xs'>
							<Stack gap={4}>
								{legalLinks.map((link) => (
									<Anchor
										key={link.id}
										href={link.href}
										size='sm'
										{...linkAnchorProps(link)}
									>
										{link.label}
									</Anchor>
								))}
							</Stack>
						</Popover.Dropdown>
					</Popover>
				) : null}
			</Box>
		</Box>
	);
}

function StackVariant({ permissions }: { permissions?: unknown }) {
	const links = getVisibleProductLinks({ permissions });

	return (
		<Stack mt='xl' gap={4} maw={560} className='field-product-links field-product-links--stack'>
			<Text
				fz={11}
				tt='uppercase'
				fw={600}
				c='dimmed'
				mb={2}
				style={SECTION_LABEL_STYLE}
			>
				Product
			</Text>
			{links.map((link) => (
				<NavLink
					key={link.id}
					component='a'
					href={link.href}
					label={link.label}
					color='brand'
					{...linkAnchorProps(link)}
					styles={{
						root: { borderRadius: 'var(--mantine-radius-md)' },
						label: { fontWeight: 500 },
					}}
				/>
			))}
		</Stack>
	);
}

function AuthFooterVariant() {
	const links = getAuthProductLinks();

	return (
		<Box className='field-product-links field-product-links--auth field-auth-footer'>
			<Group gap='sm' justify='center'>
				{links.map((link, index) => (
					<Text key={link.id} component='span' size='sm' c='dimmed'>
						{index > 0 ? (
							<Text span c='dimmed' mr='sm'>
								·
							</Text>
						) : null}
						<Anchor href={link.href} size='sm' c='dimmed' {...linkAnchorProps(link)}>
							{link.label}
						</Anchor>
					</Text>
				))}
			</Group>
		</Box>
	);
}

export function ProductLinks({ variant, permissions }: ProductLinksProps) {
	switch (variant) {
		case 'sidebar':
			return <SidebarVariant permissions={permissions} />;
		case 'stack':
			return <StackVariant permissions={permissions} />;
		case 'auth-footer':
			return <AuthFooterVariant />;
	}
}
