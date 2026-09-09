import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Box, Button, Group, Loader } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import type {
	ColDef,
	ICellRendererParams,
	RowClickedEvent,
	ValueFormatterParams,
} from 'ag-grid-community';
import { AllCommunityModule } from 'ag-grid-community';
import { AgGridProvider, AgGridReact } from 'ag-grid-react';
import { Plus, QrCode, Smartphone, Trash2 } from 'lucide-react';
import {
	createUser,
	deleteUser,
	listUsers,
	updateUser,
	type AppUser,
} from '../api/users';
import { PageHeader } from '../components/PageHeader';
import { UserFormModal } from '../components/UserFormModal';
import { IssueActivationQrModal } from '../components/IssueActivationQrModal';
import { ManageMobileDevicesModal } from '../components/ManageMobileDevicesModal';
import { useAlert } from '../context/AlertContext';
import { useCurrentUser } from '../context/CurrentUserContext';
import {
	AG_GRID_MOBILE_MQ,
	entityCustomFieldColumnDefs,
	getDefaultColDef,
	usePersistedAgGridSession,
} from '../agGridDefaults';
import { useEntityCustomFieldDefs } from '../components/CustomFieldControl';
import { hasPermission, PERMISSIONS } from '../../shared/permissions.js';
import { notifyError } from '../notify';

function ActionsCell({
	data,
	currentUserId,
	onDelete,
	onIssue,
	onManageDevices,
}: {
	data: AppUser | undefined;
	currentUserId: string | undefined;
	onDelete: (user: AppUser) => void;
	onIssue: (user: AppUser) => void;
	onManageDevices: (user: AppUser) => void;
}) {
	if (!data) return null;
	const isSelf = data.id === currentUserId;
	return (
		<Group gap={6} wrap='nowrap'>
			<Button
				variant='light'
				color='brand'
				leftSection={<QrCode size={14} />}
				onClick={(e) => {
					e.stopPropagation();
					onIssue(data);
				}}
			>
				Issue QR
			</Button>
			<Button
				variant='light'
				color='gray'
				leftSection={<Smartphone size={14} />}
				onClick={(e) => {
					e.stopPropagation();
					onManageDevices(data);
				}}
			>
				Devices
			</Button>
			{!isSelf ? (
				<Button
					variant='light'
					color='red'
					leftSection={<Trash2 size={14} />}
					onClick={(e) => {
						e.stopPropagation();
						onDelete(data);
					}}
				>
					Deactivate
				</Button>
			) : null}
		</Group>
	);
}

export function UsersPage() {
	const isDesktop = useMediaQuery('(min-width: 48em)', true, {
		getInitialValueInEffect: false,
	});
	const isMobile = useMediaQuery(AG_GRID_MOBILE_MQ);
	const {
		user: currentUser,
		loading: userLoading,
		webSsoMode,
		patchCachedUser,
	} = useCurrentUser();
	const { confirm } = useAlert();
	const [users, setUsers] = useState<AppUser[]>([]);
	const [loading, setLoading] = useState(true);
	const [formOpen, setFormOpen] = useState(false);
	const [editUser, setEditUser] = useState<AppUser | null>(null);
	const [issueUser, setIssueUser] = useState<AppUser | null>(null);
	const [devicesUser, setDevicesUser] = useState<AppUser | null>(null);

	const defaultColDef = useMemo(() => getDefaultColDef(isMobile), [isMobile]);
	const gridSession = usePersistedAgGridSession('users', !isMobile);
	const customFieldDefs = useEntityCustomFieldDefs('user');
	const canManage = hasPermission(
		currentUser?.permissions,
		PERMISSIONS.manageUsers,
	);
	const actorOpts = useMemo(
		() => ({ actorUserId: webSsoMode ? undefined : currentUser?.id }),
		[webSsoMode, currentUser?.id],
	);

	const refreshUsers = useCallback(async (signal?: AbortSignal) => {
		setLoading(true);
		try {
			const next = await listUsers(signal);
			if (!signal?.aborted) setUsers(next);
		} catch (err: unknown) {
			if (err instanceof DOMException && err.name === 'AbortError') return;
			notifyError(err instanceof Error ? err.message : 'Failed to load users');
		} finally {
			if (!signal?.aborted) setLoading(false);
		}
	}, []);

	useEffect(() => {
		const controller = new AbortController();
		void refreshUsers(controller.signal);
		return () => controller.abort();
	}, [refreshUsers]);

	const openEditUser = useCallback((user: AppUser) => {
		setEditUser(user);
		setFormOpen(true);
	}, []);

	const handleRowClicked = useCallback(
		(event: RowClickedEvent<AppUser>) => {
			const target = event.event?.target as HTMLElement | null;
			if (target?.closest('button') || target?.closest('[col-id="actions"]')) {
				return;
			}
			if (event.data) openEditUser(event.data);
		},
		[openEditUser],
	);

	const handleDeactivate = useCallback(
		async (user: AppUser) => {
			const label = user.displayName?.trim() || 'this user';
			if (
				!(await confirm(
					`Deactivate ${label}? They will lose access immediately.`,
					{ danger: true },
				))
			) {
				return;
			}
			await deleteUser(user.id, actorOpts);
			await refreshUsers();
		},
		[actorOpts, confirm, refreshUsers],
	);

	const columnDefs = useMemo<ColDef<AppUser>[]>(
		() => [
			{
				field: 'displayName',
				headerName: 'Name',
				minWidth: 140,
				flex: 1.2,
			},
			{
				field: 'email',
				headerName: 'Email',
				minWidth: 160,
				flex: 1.2,
				valueFormatter: (p: ValueFormatterParams<AppUser, string>) =>
					p.value?.trim() ? p.value : '—',
			},
			{
				field: 'phone',
				headerName: 'Phone',
				minWidth: 110,
				flex: 0.8,
				valueFormatter: (p: ValueFormatterParams<AppUser, string>) =>
					p.value?.trim() ? p.value : '—',
			},
			{
				field: 'role',
				headerName: 'Role',
				minWidth: 100,
				flex: 0.7,
				valueFormatter: (p: ValueFormatterParams<AppUser, string>) =>
					p.value?.trim() ? p.value : '—',
			},
			...entityCustomFieldColumnDefs<AppUser>(customFieldDefs),
			{
				headerName: 'Actions',
				colId: 'actions',
				minWidth: 340,
				flex: 1.5,
				sortable: false,
				filter: false,
				cellRenderer: (params: ICellRendererParams<AppUser>) => (
					<ActionsCell
						data={params.data}
						currentUserId={currentUser?.id}
						onDelete={(u) => void handleDeactivate(u)}
						onIssue={(u) => setIssueUser(u)}
						onManageDevices={(u) => setDevicesUser(u)}
					/>
				),
			},
		],
		[currentUser?.id, customFieldDefs, handleDeactivate],
	);

	if (userLoading) {
		return (
			<Group justify='center' py='xl'>
				<Loader size='sm' />
			</Group>
		);
	}

	if (!isDesktop || !canManage) {
		return <Navigate to='/' replace />;
	}

	const isCreate = formOpen && editUser == null;

	return (
		<Box className='tasks-page'>
			<PageHeader
				title='Users'
				right={
					<Button
						leftSection={<Plus size={18} />}
						color='brand'
						onClick={() => {
							setEditUser(null);
							setFormOpen(true);
						}}
					>
						New user
					</Button>
				}
			/>

			<Box className='tasks-grid-wrap ag-theme-quartz'>
				{loading && users.length === 0 ? (
					<Group justify='center' py='xl'>
						<Loader size='sm' />
					</Group>
				) : (
					<AgGridProvider modules={[AllCommunityModule]}>
						<AgGridReact<AppUser>
							rowData={users}
							columnDefs={columnDefs}
							defaultColDef={defaultColDef}
							getRowId={(p) => p.data.id}
							animateRows
							suppressCellFocus
							suppressHorizontalScroll
							rowStyle={{ cursor: 'pointer' }}
							onRowClicked={handleRowClicked}
							onGridReady={gridSession.onGridReady}
							onGridSizeChanged={gridSession.onGridSizeChanged}
							onFirstDataRendered={gridSession.onFirstDataRendered}
							onSortChanged={gridSession.onSortChanged}
							onFilterChanged={gridSession.onFilterChanged}
						/>
					</AgGridProvider>
				)}
			</Box>

			<UserFormModal
				user={editUser}
				opened={formOpen}
				isCreate={isCreate}
				lockManageUsers={editUser?.id === currentUser?.id}
				disableDelete={editUser?.id === currentUser?.id}
				onClose={() => {
					setFormOpen(false);
					setEditUser(null);
				}}
				onSave={async (values) => {
					const payload = {
						displayName: values.displayName,
						email: values.email.trim(),
						phone: values.phone.trim(),
						role: values.role,
						permissions: values.permissions,
						customFields: values.customFields,
					};
					if (isCreate) {
						const next = await createUser(payload, actorOpts);
						setUsers((prev) =>
							[...prev, next].sort((a, b) =>
								a.displayName.localeCompare(b.displayName),
							),
						);
					} else if (editUser) {
						const next = await updateUser(editUser.id, payload, actorOpts);
						setUsers((prev) =>
							prev.map((u) => (u.id === next.id ? next : u)),
						);
						patchCachedUser(next);
					}
					setFormOpen(false);
					setEditUser(null);
				}}
				onDelete={
					editUser
						? async () => {
								await deleteUser(editUser.id, actorOpts);
								setUsers((prev) =>
									prev.filter((u) => u.id !== editUser.id),
								);
								setFormOpen(false);
								setEditUser(null);
							}
						: undefined
				}
			/>

			<IssueActivationQrModal
				user={issueUser}
				opened={issueUser != null}
				onClose={() => setIssueUser(null)}
			/>

			<ManageMobileDevicesModal
				user={devicesUser}
				opened={devicesUser != null}
				onClose={() => setDevicesUser(null)}
			/>
		</Box>
	);
}
