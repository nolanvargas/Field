import { useEffect, useState } from 'react';
import {
	Button,
	Checkbox,
	Group,
	Stack,
	TextInput,
} from '@mantine/core';
import { Mail, Phone, Save, Trash2, UserRound, X } from 'lucide-react';
import type { AppUser } from '../api/users';
import { useAlert } from '../context/AlertContext';
import { KeyboardAwareModal } from './KeyboardAwareModal';
import {
	CustomFieldStack,
	useCustomFieldLookups,
	useEntityCustomFieldDefs,
} from './CustomFieldControl';
import { requiredCustomFieldError, type CustomFieldValues } from '../customFields';
import type { CustomFieldValue } from '../types/task';
import {
	ALL_PERMISSIONS,
	PERMISSION_LABELS,
	PERMISSIONS,
} from '../../shared/permissions.js';
import { notifyError } from '../notify';

export interface UserFormValues {
	displayName: string;
	email: string;
	phone: string;
	role: string;
	permissions: string[];
	customFields: CustomFieldValues;
}

type UserFormModalProps = {
	user: AppUser | null;
	opened: boolean;
	onClose: () => void;
	/** Create mode when user is null. */
	isCreate?: boolean;
	/** When true, the signed-in user cannot uncheck Manage users. */
	lockManageUsers: boolean;
	/** When true, hide delete (e.g. editing yourself). */
	disableDelete?: boolean;
	onSave: (values: UserFormValues) => void | Promise<void>;
	onDelete?: () => void | Promise<void>;
};

export function UserFormModal({
	user,
	opened,
	onClose,
	isCreate = false,
	lockManageUsers,
	disableDelete = false,
	onSave,
	onDelete,
}: UserFormModalProps) {
	const { confirm } = useAlert();
	const [displayName, setDisplayName] = useState('');
	const [email, setEmail] = useState('');
	const [phone, setPhone] = useState('');
	const [role, setRole] = useState('');
	const [permissions, setPermissions] = useState<string[]>([]);
	const [customFields, setCustomFields] = useState<CustomFieldValues>({});
	const [saving, setSaving] = useState(false);
	const [deleting, setDeleting] = useState(false);
	const customFieldDefs = useEntityCustomFieldDefs('user');
	const { catalogs, loading } = useCustomFieldLookups(customFieldDefs, opened);

	useEffect(() => {
		if (!opened) return;
		if (isCreate || !user) {
			setDisplayName('');
			setEmail('');
			setPhone('');
			setRole('');
			setPermissions([]);
			setCustomFields({});
		} else {
			setDisplayName(user.displayName ?? '');
			setEmail(user.email ?? '');
			setPhone(user.phone ?? '');
			setRole(user.role ?? '');
			setPermissions([...(user.permissions ?? [])]);
			setCustomFields({ ...(user.customFields ?? {}) });
		}
	}, [opened, user, isCreate]);

	const updateCustomField = (slot: number, value: CustomFieldValue) => {
		setCustomFields((prev) => ({ ...prev, [String(slot)]: value }));
	};

	const handleClose = () => {
		if (saving || deleting) return;
		onClose();
	};

	const handleSave = async () => {
		if (saving || deleting) return;
		if (!displayName.trim()) {
			notifyError('Name is required');
			return;
		}
		const missing = requiredCustomFieldError(customFields, customFieldDefs);
		if (missing) {
			notifyError(missing);
			return;
		}
		const nextPermissions = lockManageUsers
			? Array.from(new Set([...permissions, PERMISSIONS.manageUsers]))
			: permissions;
		setSaving(true);
		try {
			await onSave({
				displayName: displayName.trim(),
				email: email.trim(),
				phone: phone.trim(),
				role: role.trim(),
				permissions: nextPermissions,
				customFields,
			});
		} catch (err: unknown) {
			notifyError(err instanceof Error ? err.message : 'Save failed');
		} finally {
			setSaving(false);
		}
	};

	const handleDelete = async () => {
		if (!onDelete || deleting || saving) return;
		const label = user?.displayName?.trim() || 'this user';
		if (
			!(await confirm(
				`Deactivate ${label}? They will lose access immediately.`,
				{ danger: true },
			))
		) {
			return;
		}
		setDeleting(true);
		try {
			await onDelete();
		} catch (err: unknown) {
			notifyError(err instanceof Error ? err.message : 'Delete failed');
		} finally {
			setDeleting(false);
		}
	};

	const title = isCreate
		? 'New user'
		: user
			? `Edit ${user.displayName}`
			: 'Edit user';

	return (
		<KeyboardAwareModal
			opened={opened}
			onClose={handleClose}
			title={title}
			size='lg'
		>
			<Stack gap='md'>
				<TextInput
					label='Name'
					placeholder='Full name'
					value={displayName}
					onChange={(e) => setDisplayName(e.currentTarget.value)}
					maxLength={255}
					required
					leftSection={<UserRound size={16} />}
					disabled={saving || deleting}
				/>
				<TextInput
					label='Email'
					placeholder='name@company.com'
					value={email}
					onChange={(e) => setEmail(e.currentTarget.value)}
					maxLength={255}
					leftSection={<Mail size={16} />}
					disabled={saving || deleting}
				/>
				<TextInput
					label='Phone'
					placeholder='Optional'
					value={phone}
					onChange={(e) => setPhone(e.currentTarget.value)}
					maxLength={50}
					leftSection={<Phone size={16} />}
					disabled={saving || deleting}
				/>
				<TextInput
					label='Role'
					placeholder='e.g. Foreman, Dispatcher'
					value={role}
					onChange={(e) => setRole(e.currentTarget.value)}
					maxLength={50}
					disabled={saving || deleting}
				/>
				<Checkbox.Group
					label='Extra access'
					description='Standard access is already included. These keys add Users, Management, or Crew map.'
					value={permissions}
					onChange={setPermissions}
				>
					<Stack gap={8} mt={8}>
						{ALL_PERMISSIONS.map((key) => (
							<Checkbox
								key={key}
								value={key}
								label={PERMISSION_LABELS[key] ?? key}
								disabled={
									saving ||
									deleting ||
									(lockManageUsers && key === PERMISSIONS.manageUsers)
								}
							/>
						))}
					</Stack>
				</Checkbox.Group>
				<CustomFieldStack
					defs={customFieldDefs}
					values={customFields}
					onChange={updateCustomField}
					disabled={saving || deleting}
					catalogs={catalogs}
					loading={loading}
				/>
				<Group justify='space-between' gap='sm' wrap='nowrap'>
					{!isCreate && onDelete && !disableDelete ? (
						<Button
							variant='light'
							color='red'
							leftSection={<Trash2 size={16} />}
							onClick={() => void handleDelete()}
							loading={deleting}
							disabled={saving}
						>
							Deactivate
						</Button>
					) : (
						<span />
					)}
					<Group gap='sm' wrap='nowrap'>
						<Button
							variant='default'
							leftSection={<X size={16} />}
							onClick={handleClose}
							disabled={saving || deleting}
						>
							Cancel
						</Button>
						<Button
							leftSection={<Save size={16} />}
							onClick={() => void handleSave()}
							loading={saving}
							disabled={deleting}
						>
							Save
						</Button>
					</Group>
				</Group>
			</Stack>
		</KeyboardAwareModal>
	);
}
