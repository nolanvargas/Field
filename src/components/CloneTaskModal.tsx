import { useEffect, useState } from 'react';
import { Button, Checkbox, Group, Stack, Text } from '@mantine/core';
import { cloneTask } from '../api/tasks';
import { useCurrentUser } from '../context/CurrentUserContext';
import { useOrgSettings } from '../context/OrgSettingsContext';
import {
	REQUIRED_TASK_FIELDS,
	isTaskFieldRequired,
} from '../../shared/requiredTaskFields.js';
import { KeyboardAwareModal } from './KeyboardAwareModal';
import { notifyError } from '../notify';

export type CloneTaskModalProps = {
	taskId: number | null;
	opened: boolean;
	onClose: () => void;
	onCloned: (newTaskId: number) => void | Promise<void>;
};

type CloneOptionsState = {
	includeContacts: boolean;
	includeCrew: boolean;
	includeDates: boolean;
	includeAttachments: boolean;
	includeExternalKey: boolean;
};

const DEFAULT_OPTIONS: CloneOptionsState = {
	includeContacts: true,
	includeCrew: true,
	includeDates: true,
	includeAttachments: true,
	includeExternalKey: false,
};

export function CloneTaskModal({
	taskId,
	opened,
	onClose,
	onCloned,
}: CloneTaskModalProps) {
	const { user } = useCurrentUser();
	const { settings: orgSettings } = useOrgSettings();
	const requireContacts = isTaskFieldRequired(
		orgSettings.requiredTaskFields,
		REQUIRED_TASK_FIELDS.contacts,
	);
	const requireCrew = isTaskFieldRequired(
		orgSettings.requiredTaskFields,
		REQUIRED_TASK_FIELDS.crew,
	);
	const requireDates =
		isTaskFieldRequired(
			orgSettings.requiredTaskFields,
			REQUIRED_TASK_FIELDS.afterDateTime,
		) ||
		isTaskFieldRequired(
			orgSettings.requiredTaskFields,
			REQUIRED_TASK_FIELDS.beforeDateTime,
		);
	const requireExternalKey = isTaskFieldRequired(
		orgSettings.requiredTaskFields,
		REQUIRED_TASK_FIELDS.externalKey,
	);
	const [options, setOptions] = useState<CloneOptionsState>(DEFAULT_OPTIONS);
	const [busy, setBusy] = useState(false);

	const updateOption = (
		key: keyof CloneOptionsState,
		checked: boolean,
	) => {
		setOptions((prev) => ({ ...prev, [key]: checked }));
	};

	useEffect(() => {
		if (!opened) return;
		setOptions(DEFAULT_OPTIONS);
		setBusy(false);
	}, [opened, taskId]);

	const handleClone = async () => {
		if (taskId == null || busy) return;
		if (!user) {
			notifyError('Select a user in the sidebar before cloning a task');
			return;
		}

		setBusy(true);
		try {
			const created = await cloneTask(taskId, {
				createdByUserId: user.id,
				includeContacts: options.includeContacts || requireContacts,
				includeCrew: options.includeCrew || requireCrew,
				includeDates: options.includeDates || requireDates,
				includeAttachments: options.includeAttachments,
				includeExternalKey: options.includeExternalKey || requireExternalKey,
			});
			await onCloned(created.id);
			onClose();
		} catch (err: unknown) {
			notifyError(err instanceof Error ? err.message : 'Clone task failed');
		} finally {
			setBusy(false);
		}
	};

	return (
		<KeyboardAwareModal
			opened={opened}
			onClose={() => {
				if (!busy) onClose();
			}}
			title={taskId != null ? `Clone task #${taskId}` : 'Clone task'}
			size='sm'
			centered
			closeOnClickOutside={!busy}
			closeOnEscape={!busy}
		>
			<Stack gap='md'>
				<Text size='sm' c='dimmed'>
					Choose what to copy onto the new task. Type, title, description,
					destination, and flags are always included.
				</Text>

				<Stack gap='xs'>
					<Checkbox
						label='Contacts'
						checked={options.includeContacts || requireContacts}
						disabled={busy || requireContacts}
						onChange={(e) =>
							updateOption('includeContacts', e.currentTarget.checked)
						}
					/>
					<Checkbox
						label='Crew'
						checked={options.includeCrew || requireCrew}
						disabled={busy || requireCrew}
						onChange={(e) =>
							updateOption('includeCrew', e.currentTarget.checked)
						}
					/>
					<Checkbox
						label='Dates'
						checked={options.includeDates || requireDates}
						disabled={busy || requireDates}
						onChange={(e) =>
							updateOption('includeDates', e.currentTarget.checked)
						}
					/>
					<Checkbox
						label='Attachments'
						checked={options.includeAttachments}
						disabled={busy}
						onChange={(e) =>
							updateOption('includeAttachments', e.currentTarget.checked)
						}
					/>
					<Checkbox
						label='External key'
						checked={options.includeExternalKey || requireExternalKey}
						disabled={busy || requireExternalKey}
						onChange={(e) =>
							updateOption('includeExternalKey', e.currentTarget.checked)
						}
					/>
				</Stack>

				<Group justify='flex-end' gap='sm'>
					<Button variant='default' onClick={onClose} disabled={busy}>
						Cancel
					</Button>
					<Button onClick={() => void handleClone()} loading={busy}>
						Clone
					</Button>
				</Group>
			</Stack>
		</KeyboardAwareModal>
	);
}
