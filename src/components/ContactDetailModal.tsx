import { useEffect, useState } from 'react';
import {
	Stack,
	Group,
	SimpleGrid,
	Loader,
	Alert,
	Button,
} from '@mantine/core';
import { Pencil, Trash2 } from 'lucide-react';
import { getContact, type Contact } from '../api/contacts';
import { useAlert } from '../context/AlertContext';
import { notifyError } from '../notify';
import { KeyboardAwareModal } from './KeyboardAwareModal';
import { DetailField } from './DetailField';
import { entityModalHeaderStyles } from './entityModalHeaderStyles';
import { useEntityCustomFieldDefs } from './CustomFieldControl';
import { customFieldDetailRows } from './CustomFieldValueText';

interface ContactDetailModalProps {
	contactId: number | null;
	opened: boolean;
	onClose: () => void;
	onEdit?: (contact: Contact) => void;
	onDelete?: (contact: Contact) => Promise<void>;
}

export function ContactDetailModal({
	contactId,
	opened,
	onClose,
	onEdit,
	onDelete,
}: ContactDetailModalProps) {
	const { confirm } = useAlert();
	const [contact, setContact] = useState<Contact | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [deleting, setDeleting] = useState(false);
	const customFieldDefs = useEntityCustomFieldDefs('contact');

	useEffect(() => {
		if (!opened || contactId == null) {
			setContact(null);
			setError(null);
			setLoading(false);
			setDeleting(false);
			return;
		}

		const controller = new AbortController();
		setLoading(true);
		setError(null);
		setContact(null);

		getContact(contactId, controller.signal)
			.then((next) => {
				if (!controller.signal.aborted) setContact(next);
			})
			.catch((err: unknown) => {
				if (err instanceof DOMException && err.name === 'AbortError') return;
				setError(err instanceof Error ? err.message : 'Failed to load contact');
			})
			.finally(() => {
				if (!controller.signal.aborted) setLoading(false);
			});

		return () => controller.abort();
	}, [opened, contactId]);

	const handleDelete = async () => {
		if (!contact || !onDelete) return;
		if (
			!(await confirm(`Delete contact “${contact.name}”?`, { danger: true }))
		) {
			return;
		}
		setDeleting(true);
		try {
			await onDelete(contact);
		} catch (err: unknown) {
			notifyError(
				err instanceof Error ? err.message : 'Failed to delete contact',
			);
			setDeleting(false);
		}
	};

	const title =
		contact?.name || (contactId != null ? `Contact #${contactId}` : 'Contact');

	return (
		<KeyboardAwareModal
			opened={opened}
			onClose={onClose}
			title={title}
			size='md'
			centered
			styles={entityModalHeaderStyles}
		>
			{loading ? (
				<Group justify='center' py='xl'>
					<Loader size='sm' />
				</Group>
			) : error ? (
				<Alert color='red' title='Could not load contact'>
					{error}
				</Alert>
			) : contact ? (
				<Stack gap='md'>
					<SimpleGrid cols={{ base: 1, sm: 2 }} spacing='sm'>
						<DetailField label='Name' value={contact.name} span={2} />
						<DetailField label='Title' value={contact.title} span={2} />
						<DetailField label='Phone' value={contact.phone} />
						<DetailField label='Email' value={contact.email} />
						{customFieldDetailRows(customFieldDefs, contact, (row) => (
							<DetailField
								key={row.key}
								label={row.label}
								value={row.value}
							/>
						))}
					</SimpleGrid>

					<Group justify='space-between' gap={6} wrap='nowrap'>
						{onDelete ? (
							<Button
								color='red'
								variant='light'
								leftSection={<Trash2 size={16} />}
								onClick={() => void handleDelete()}
								loading={deleting}
								disabled={deleting}
							>
								Delete
							</Button>
						) : (
							<span />
						)}
						<Group gap={6} wrap='nowrap'>
							<Button variant='default' onClick={onClose} disabled={deleting}>
								Close
							</Button>
							{onEdit ? (
								<Button
									color='brand'
									leftSection={<Pencil size={16} />}
									onClick={() => onEdit(contact)}
									disabled={deleting}
								>
									Edit
								</Button>
							) : null}
						</Group>
					</Group>
				</Stack>
			) : null}
		</KeyboardAwareModal>
	);
}
