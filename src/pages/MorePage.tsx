import { useMemo, useState } from 'react';
import { Navigate, NavLink as RouterNavLink, useLocation, useNavigate } from 'react-router-dom';
import {
	Anchor,
	Box,
	Button,
	MultiSelect,
	NavLink,
	Stack,
	Switch,
	Text,
	TextInput,
	Title,
	UnstyledButton,
	useMantineColorScheme,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { Capacitor } from '@capacitor/core';
import {
	Bell,
	ChevronRight,
	ExternalLink,
	LogOut,
	Mail,
	MapPinned,
	QrCode,
} from 'lucide-react';
import { AG_GRID_MOBILE_MQ } from '../agGridDefaults';
import {
	activateFromQrScan,
	activateWithCode,
	canScanActivationQr,
} from '../auth/activateFromQr';
import { clearMobileSession } from '../auth/mobileSession';
import { PageHeader } from '../components/PageHeader';
import { ProductLinks } from '../components/ProductLinks';
import { getVisibleProductLinks } from '../productLinks';
import { UserSelect } from '../components/UserSelect';
import { TaskSearchInput } from '../components/TaskSearchInput';
import { useAlert } from '../context/AlertContext';
import { useCurrentUser } from '../context/CurrentUserContext';
import { useOrgSettings } from '../context/OrgSettingsContext';
import { useLargeFont } from '../largeFont';
import { useTaskListTypeFilters } from '../taskListTypeFilters';
import { hasPermission, PERMISSIONS } from '../../shared/permissions.js';
import { notifyError, notifySuccess } from '../notify';

const PAGE_TITLE_STYLE = { fontFamily: 'var(--font-display)' } as const;
const SECTION_LABEL_STYLE = { letterSpacing: '0.04em' } as const;

type SettingsSectionId =
	| 'task-lists'
	| 'appearance'
	| 'support'
	| 'help'
	| 'terms'
	| 'privacy'
	| 'billing';

type SettingsSectionDef = {
	id: SettingsSectionId;
	label: string;
	permission?: string;
};

const SETTINGS_SECTIONS: SettingsSectionDef[] = [
	{ id: 'task-lists', label: 'Task lists' },
	{ id: 'appearance', label: 'Appearance' },
	{ id: 'support', label: 'Support' },
	{ id: 'help', label: 'Help' },
	{ id: 'terms', label: 'Terms' },
	{ id: 'privacy', label: 'Privacy' },
	{ id: 'billing', label: 'Billing', permission: PERMISSIONS.manageOrg },
];

function TaskListFilterSection({
	mt,
	showHeading = true,
}: {
	mt?: 'xl';
	showHeading?: boolean;
}) {
	const { settings: orgSettings } = useOrgSettings();
	const [taskTypeFilters, setTaskTypeFilters] = useTaskListTypeFilters();
	const enabledTaskTypeOptions = useMemo(
		() =>
			orgSettings.taskTypes
				.filter((type) => type.enabled)
				.map((type) => type.name),
		[orgSettings.taskTypes],
	);

	return (
		<Stack mt={mt} gap='sm' maw={560}>
			{showHeading ? (
				<Text
					fz={11}
					tt='uppercase'
					fw={600}
					c='dimmed'
					style={SECTION_LABEL_STYLE}
				>
					Task lists
				</Text>
			) : null}
			<MultiSelect
				label='Show tasks of type'
				placeholder='All types'
				data={enabledTaskTypeOptions}
				value={taskTypeFilters}
				onChange={setTaskTypeFilters}
				clearable
				searchable
				variant='default'
			/>
		</Stack>
	);
}

function DarkModeSwitch() {
	const { colorScheme, setColorScheme } = useMantineColorScheme();
	const isDark = colorScheme === 'dark';
	return (
		<Switch
			label='Dark mode'
			checked={isDark}
			onChange={(e) =>
				setColorScheme(e.currentTarget.checked ? 'dark' : 'light')
			}
			color='brand'
		/>
	);
}

function LargerTextSwitch() {
	const [largeFont, setLargeFont] = useLargeFont();
	return (
		<Switch
			label='Larger text'
			checked={largeFont}
			onChange={(e) => setLargeFont(e.currentTarget.checked)}
			color='brand'
		/>
	);
}

/** Desktop: personal settings with sub-nav mirroring ManagementPage style. */
function DesktopSettingsPage() {
	const { user } = useCurrentUser();
	const [activeSection, setActiveSection] =
		useState<SettingsSectionId>('task-lists');

	const productLinks = useMemo(
		() => getVisibleProductLinks({ permissions: user?.permissions }),
		[user?.permissions],
	);

	const linkById = useMemo(
		() => new Map(productLinks.map((l) => [l.id, l])),
		[productLinks],
	);

	const visibleSections = useMemo(
		() =>
			SETTINGS_SECTIONS.filter(
				(section) =>
					!section.permission ||
					hasPermission(user?.permissions, section.permission),
			),
		[user?.permissions],
	);

	const supportLink = linkById.get('support');
	const helpLink = linkById.get('help');
	const termsLink = linkById.get('terms');
	const privacyLink = linkById.get('privacy');
	const billingLink = linkById.get('billing');

	return (
		<div className='field-management-page'>
			<PageHeader title='Settings' />

			<div className='field-management-body'>
				<nav className='field-management-nav' aria-label='Settings sections'>
					{visibleSections.map((section) => (
						<UnstyledButton
							key={section.id}
							type='button'
							className='field-management-nav-btn'
							data-active={activeSection === section.id || undefined}
							aria-current={activeSection === section.id ? 'page' : undefined}
							onClick={() => setActiveSection(section.id)}
						>
							{section.label}
						</UnstyledButton>
					))}
				</nav>

				<div className='field-management-divider' aria-hidden='true' />

				<div className='field-management-content'>
					{activeSection === 'task-lists' ? (
						<Box maw={560}>
							<Title order={4} mb='xs'>
								Task lists
							</Title>
							<Text size='sm' c='dimmed' mb='md'>
								Filter which task types appear across your task lists.
							</Text>
							<TaskListFilterSection showHeading={false} />
						</Box>
					) : null}

					{activeSection === 'appearance' ? (
						<Box maw={560}>
							<Title order={4} mb='xs'>
								Appearance
							</Title>
							<Text size='sm' c='dimmed' mb='md'>
								Customize theme and readability preferences.
							</Text>
							<Stack gap='md'>
								<DarkModeSwitch />
								<LargerTextSwitch />
							</Stack>
						</Box>
					) : null}

					{activeSection === 'support' && supportLink ? (
						<Box maw={560}>
							<Title order={4} mb='xs'>
								Support
							</Title>
							<Text size='sm' c='dimmed' mb='md'>
								Get help from our team with questions, feedback, or technical
								assistance.
							</Text>
							<Button
								component='a'
								href={supportLink.href}
								variant='light'
								color='brand'
								leftSection={<Mail size={16} />}
							>
								Contact support
							</Button>
						</Box>
					) : null}

					{activeSection === 'help' && helpLink ? (
						<Box maw={560}>
							<Title order={4} mb='xs'>
								Help & documentation
							</Title>
							<Text size='sm' c='dimmed' mb='md'>
								Browse documentation, user guides, and troubleshooting steps.
							</Text>
							<Button
								component='a'
								href={helpLink.href}
								target='_blank'
								rel='noopener noreferrer'
								variant='light'
								color='brand'
								rightSection={<ExternalLink size={14} />}
							>
								Open help center
							</Button>
						</Box>
					) : null}

					{activeSection === 'terms' && termsLink ? (
						<Box maw={560}>
							<Title order={4} mb='xs'>
								Terms of service
							</Title>
							<Text size='sm' c='dimmed' mb='md'>
								Review terms and conditions governing the use of Field.
							</Text>
							<Button
								component='a'
								href={termsLink.href}
								target='_blank'
								rel='noopener noreferrer'
								variant='light'
								color='brand'
								rightSection={<ExternalLink size={14} />}
							>
								View terms of service
							</Button>
						</Box>
					) : null}

					{activeSection === 'privacy' && privacyLink ? (
						<Box maw={560}>
							<Title order={4} mb='xs'>
								Privacy policy
							</Title>
							<Text size='sm' c='dimmed' mb='md'>
								Learn how your personal data and organization information are
								protected.
							</Text>
							<Button
								component='a'
								href={privacyLink.href}
								target='_blank'
								rel='noopener noreferrer'
								variant='light'
								color='brand'
								rightSection={<ExternalLink size={14} />}
							>
								View privacy policy
							</Button>
						</Box>
					) : null}

					{activeSection === 'billing' && billingLink ? (
						<Box maw={560}>
							<Title order={4} mb='xs'>
								Billing
							</Title>
							<Text size='sm' c='dimmed' mb='md'>
								Manage your organization subscription, payment methods, and
								invoices.
							</Text>
							<Button
								component='a'
								href={billingLink.href}
								target='_blank'
								rel='noopener noreferrer'
								variant='light'
								color='brand'
								rightSection={<ExternalLink size={14} />}
							>
								Open billing portal
							</Button>
						</Box>
					) : null}
				</div>
			</div>
		</div>
	);
}

/** Mobile settings/account surface (user select, QR re-activate, etc.). */
function MobileMorePage() {
	const navigate = useNavigate();
	const isNative = Capacitor.isNativePlatform();
	const { user, mobileSession, refreshAfterMobileActivation } = useCurrentUser();
	const { confirm } = useAlert();
	const [code, setCode] = useState('');
	const [busy, setBusy] = useState(false);
	const [deactivating, setDeactivating] = useState(false);
	const showScan = canScanActivationQr();

	const finishActivate = async (fn: () => Promise<{ displayName: string }>) => {
		setBusy(true);
		try {
			const { displayName } = await fn();
			await refreshAfterMobileActivation();
			notifySuccess(`Signed in as ${displayName}`);
			setCode('');
		} catch (err: unknown) {
			notifyError(
				err instanceof Error ? err.message : 'Failed to activate device',
			);
		} finally {
			setBusy(false);
		}
	};

	const handleDeactivate = async () => {
		if (
			!(await confirm(
				'Clear this device session and return to QR activation?',
				{ danger: true },
			))
		) {
			return;
		}
		setDeactivating(true);
		try {
			await clearMobileSession();
		} catch (err: unknown) {
			notifyError(
				err instanceof Error ? err.message : 'Failed to clear device session',
			);
		} finally {
			setDeactivating(false);
		}
	};

	return (
		<Box className='field-more-page'>
			<Title order={2} mb='lg' style={PAGE_TITLE_STYLE}>
				More
			</Title>
			<Text
				fz={11}
				tt='uppercase'
				fw={600}
				c='dimmed'
				mb={6}
				style={SECTION_LABEL_STYLE}
			>
				Signed in as
			</Text>
			{mobileSession ? (
				<Text mb='md' fw={500}>
					{mobileSession.displayName}
				</Text>
			) : (
				<UserSelect variant='light' />
			)}

			<TaskListFilterSection mt='xl' />

			<Stack mt='xl' gap='sm'>
				<Text
					fz={11}
					tt='uppercase'
					fw={600}
					c='dimmed'
					style={SECTION_LABEL_STYLE}
				>
					Task search
				</Text>
				<TaskSearchInput
					variant='light'
					onFound={(id) => navigate(`/task/${id}`)}
				/>
			</Stack>

			<Stack mt='xl' gap='sm'>
				<Text
					fz={11}
					tt='uppercase'
					fw={600}
					c='dimmed'
					style={SECTION_LABEL_STYLE}
				>
					Settings
				</Text>
				<DarkModeSwitch />
				<LargerTextSwitch />
			</Stack>

			<Stack mt='xl' gap={4}>
				<Text
					fz={11}
					tt='uppercase'
					fw={600}
					c='dimmed'
					mb={2}
					style={SECTION_LABEL_STYLE}
				>
					Pages
				</Text>
				<NavLink
					component={RouterNavLink}
					to='/addresses'
					label='Addresses'
					leftSection={<MapPinned size={18} />}
					rightSection={<ChevronRight size={16} />}
					color='brand'
					styles={{
						root: { borderRadius: 'var(--mantine-radius-md)' },
						label: { fontWeight: 500 },
					}}
				/>
				<NavLink
					component={RouterNavLink}
					to='/notifications'
					label='Notifications'
					leftSection={<Bell size={18} />}
					rightSection={<ChevronRight size={16} />}
					color='brand'
					styles={{
						root: { borderRadius: 'var(--mantine-radius-md)' },
						label: { fontWeight: 500 },
					}}
				/>
			</Stack>

			{isNative ? (
				<Stack mt='xl' gap='sm'>
					<Text
						fz={11}
						tt='uppercase'
						fw={600}
						c='dimmed'
						style={SECTION_LABEL_STYLE}
					>
						Device activation
					</Text>
					<TextInput
						label='Activation code'
						placeholder='field1.…'
						value={code}
						onChange={(e) => setCode(e.currentTarget.value)}
						disabled={busy}
						autoCapitalize='off'
						autoCorrect='off'
						spellCheck={false}
					/>
					<Button
						onClick={() => void finishActivate(() => activateWithCode(code))}
						loading={busy}
						disabled={busy || !code.trim()}
						color='brand'
						fullWidth
					>
						Activate with code
					</Button>
					{showScan && !mobileSession ? (
						<Button
							leftSection={<QrCode size={18} />}
							onClick={() => void finishActivate(() => activateFromQrScan())}
							loading={busy}
							disabled={busy}
							variant='light'
							color='brand'
							fullWidth
						>
							Scan new activation QR
						</Button>
					) : null}
					{mobileSession ? (
						<Button
							leftSection={<LogOut size={18} />}
							onClick={() => void handleDeactivate()}
							loading={deactivating}
							variant='light'
							color='red'
							fullWidth
						>
							Deactivate this device
						</Button>
					) : null}
				</Stack>
			) : null}

			<ProductLinks variant='stack' permissions={user?.permissions} />
		</Box>
	);
}

/** More on mobile; Settings on desktop (appearance + task list filter). */
export function MorePage() {
	const { pathname } = useLocation();
	const isMobile = useMediaQuery(AG_GRID_MOBILE_MQ, true, {
		getInitialValueInEffect: false,
	});

	if (!isMobile && pathname === '/more') {
		return <Navigate to='/settings' replace />;
	}
	if (isMobile && pathname === '/settings') {
		return <Navigate to='/more' replace />;
	}

	return isMobile ? <MobileMorePage /> : <DesktopSettingsPage />;
}
