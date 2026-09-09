import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
	AppShell,
	Divider,
	NavLink,
	Box,
	UnstyledButton,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import {
	ClipboardCheck,
	ClipboardList,
	Code,
	Contact,
	Map,
	MapPinned,
	Menu,
	Settings,
	Users,
} from 'lucide-react';
import { AG_GRID_MOBILE_MQ } from '../agGridDefaults';
import { useCurrentUser } from '../context/CurrentUserContext';
import { useOrgSettings } from '../context/OrgSettingsContext';
import { hasPermission, PERMISSIONS } from '../../shared/permissions.js';
import { resolveTaskListTypeFilters } from '../../shared/resolveTaskListTypeFilters.js';
import { taskListPageLabels } from '../../shared/taskListPageLabels.js';
import { useTaskListTypeFilters } from '../taskListTypeFilters';
import { EntraSignedIn, showWebSsoSignedIn } from '../auth/EntraSignedIn';
import { BrandLogo } from './BrandLogo';
import { FieldRouterNavLink, isNavActive } from './FieldRouterNavLink';
import { MobilePersistentOutlet } from './MobilePersistentOutlet';
import { ProductLinks } from './ProductLinks';
import { TaskDetailModal } from './TaskDetailModal';
import { TaskSearchInput } from './TaskSearchInput';
import { UserSelect } from './UserSelect';

const navLinkStyles = {
	root: {
		borderRadius: 'var(--mantine-radius-md)',
		color: 'var(--color-text-on-dark-muted)',
	},
	label: { fontWeight: 500 },
} as const;

export function FieldAppShell() {
	const location = useLocation();
	const navigate = useNavigate();
	const { user } = useCurrentUser();
	const { settings: orgSettings } = useOrgSettings();
	const showUsersNav = hasPermission(user?.permissions, PERMISSIONS.manageUsers);
	const showManagementNav = hasPermission(
		user?.permissions,
		PERMISSIONS.manageOrg,
	);
	const showCrewMapNav = hasPermission(
		user?.permissions,
		PERMISSIONS.viewCrewMap,
	);
	const showAllTasksNav = hasPermission(
		user?.permissions,
		PERMISSIONS.viewAllTasks,
	);
	const isMobile = useMediaQuery(AG_GRID_MOBILE_MQ, true, {
		getInitialValueInEffect: false,
	});
	const [searchTaskId, setSearchTaskId] = useState<number | null>(null);
	const [userTypeFilters] = useTaskListTypeFilters();
	const enabledTaskTypeNames = useMemo(
		() =>
			orgSettings.taskTypes
				.filter((type) => type.enabled)
				.map((type) => type.name),
		[orgSettings.taskTypes],
	);

	const pageLabels = useMemo(() => {
		const activeFilters = resolveTaskListTypeFilters({
			userFilters: userTypeFilters,
			enabledTypeNames: enabledTaskTypeNames,
		});
		return taskListPageLabels(activeFilters, orgSettings.taskTypes);
	}, [orgSettings.taskTypes, userTypeFilters, enabledTaskTypeNames]);

	const bottomNavItems = useMemo(() => {
		const items = [
			{
				to: '/my-tasks',
				end: false,
				label: pageLabels.mine,
				icon: ClipboardCheck,
			},
		];
		if (showAllTasksNav) {
			items.push({
				to: '/tasks',
				end: false,
				label: pageLabels.all,
				icon: ClipboardList,
			});
		}
		items.push(
			{
				to: '/contacts',
				end: false,
				label: 'Contacts',
				icon: Contact,
			},
			{ to: '/more', end: false, label: 'More', icon: Menu },
		);
		return items;
	}, [pageLabels, showAllTasksNav]);

	return (
		<AppShell
			padding='md'
			layout='alt'
			footer={{ height: 64 }}
			navbar={{
				width: 240,
				breakpoint: 'sm',
				collapsed: { mobile: true },
			}}
			className='field-app-shell'
			styles={{
				navbar: {
					background: 'var(--color-sidebar)',
					borderRight: 'none',
					zIndex: 202,
				},
				footer: {
					background: 'var(--color-sidebar)',
					borderTop: 'none',
					zIndex: 201,
				},
				main: {
					background: 'transparent',
				},
			}}
		>
			<AppShell.Navbar p='md' visibleFrom='sm'>
				<AppShell.Section mb='md'>
					<BrandLogo size={40} />
				</AppShell.Section>

				<AppShell.Section mb='md'>
					<TaskSearchInput
						variant='sidebar'
						onFound={(id) => {
							if (isMobile) {
								navigate(`/task/${id}`);
							} else {
								setSearchTaskId(id);
							}
						}}
					/>
					<Divider className='field-nav-divider' mt='sm' />
				</AppShell.Section>

				<AppShell.Section grow>
					<NavLink
						component={FieldRouterNavLink}
						to='/my-tasks'
						label={pageLabels.mine}
						leftSection={<ClipboardCheck size={18} />}
						active={location.pathname === '/my-tasks'}
						color='brand'
						styles={navLinkStyles}
						className='field-nav-link'
					/>
					{showAllTasksNav ? (
						<NavLink
							component={FieldRouterNavLink}
							to='/tasks'
							label={pageLabels.all}
							leftSection={<ClipboardList size={18} />}
							active={location.pathname === '/tasks'}
							color='brand'
							styles={navLinkStyles}
							className='field-nav-link'
							mt={4}
						/>
					) : null}
					<NavLink
						component={FieldRouterNavLink}
						to='/contacts'
						label='Contacts'
						leftSection={<Contact size={18} />}
						active={location.pathname === '/contacts'}
						color='brand'
						styles={navLinkStyles}
						className='field-nav-link'
						mt={4}
					/>
					<NavLink
						component={FieldRouterNavLink}
						to='/addresses'
						label='Addresses'
						leftSection={<MapPinned size={18} />}
						active={location.pathname === '/addresses'}
						color='brand'
						styles={navLinkStyles}
						className='field-nav-link'
						mt={4}
					/>
					{showUsersNav ? (
						<NavLink
							component={FieldRouterNavLink}
							to='/users'
							label='Users'
							leftSection={<Users size={18} />}
							active={location.pathname === '/users'}
							color='brand'
							styles={navLinkStyles}
							className='field-nav-link'
							mt={4}
						/>
					) : null}
					{showManagementNav ? (
						<NavLink
							component={FieldRouterNavLink}
							to='/management'
							label='Management'
							leftSection={<Settings size={18} />}
							active={location.pathname === '/management'}
							color='brand'
							styles={navLinkStyles}
							className='field-nav-link'
							mt={4}
						/>
					) : null}
					{showCrewMapNav ? (
						<NavLink
							component={FieldRouterNavLink}
							to='/crew-map'
							label='Crew map'
							leftSection={<Map size={18} />}
							active={location.pathname === '/crew-map'}
							color='brand'
							styles={navLinkStyles}
							className='field-nav-link'
							mt={4}
						/>
					) : null}
					{import.meta.env.DEV ? (
						<NavLink
							component={FieldRouterNavLink}
							to='/development'
							label='Development'
							leftSection={<Code size={18} />}
							active={location.pathname.startsWith('/development')}
							color='brand'
							styles={navLinkStyles}
							className='field-nav-link'
							mt={4}
						/>
					) : null}
				</AppShell.Section>

				<AppShell.Section mt='md'>
					<Divider className='field-nav-divider' mb='sm' />
					<ProductLinks variant='sidebar' permissions={user?.permissions} />
					{showWebSsoSignedIn() ? <EntraSignedIn /> : <UserSelect />}
				</AppShell.Section>
			</AppShell.Navbar>

			<AppShell.Footer hiddenFrom='sm' className='field-bottom-nav'>
				<nav className='field-bottom-nav-inner' aria-label='Main'>
					{bottomNavItems.map(({ to, end, label, icon: Icon }) => {
						const active = isNavActive(location.pathname, to, end);
						return (
							<UnstyledButton
								key={to}
								component={FieldRouterNavLink}
								to={to}
								end={end}
								className='field-bottom-nav-item'
								data-active={active || undefined}
								aria-current={active ? 'page' : undefined}
							>
								<Icon size={22} strokeWidth={active ? 2.25 : 2} aria-hidden />
								<span>{label}</span>
							</UnstyledButton>
						);
					})}
				</nav>
			</AppShell.Footer>

			<AppShell.Main>
				<Box className='field-main-content'>
					<MobilePersistentOutlet />
				</Box>
			</AppShell.Main>

			<TaskDetailModal
				taskId={searchTaskId}
				opened={!isMobile && searchTaskId != null}
				onClose={() => setSearchTaskId(null)}
				onCloned={(newTaskId) => setSearchTaskId(newTaskId)}
			/>
		</AppShell>
	);
}