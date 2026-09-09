import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Group, Loader, Box } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { Plus } from 'lucide-react';
import type { RowClickedEvent } from 'ag-grid-community';
import { AllCommunityModule } from 'ag-grid-community';
import { AgGridProvider, AgGridReact } from 'ag-grid-react';
import {
	createContact,
	deleteContact,
	listContacts,
	updateContact,
	type Contact,
} from '../api/contacts';
import {
	NewContactModal,
	type NewContactFormValues,
} from '../components/NewContactModal';
import { ContactDetailModal } from '../components/ContactDetailModal';
import { PageHeader } from '../components/PageHeader';
import {
	AG_GRID_MOBILE_MQ,
	contactColumnDefs,
	entityCustomFieldColumnDefs,
	getDefaultColDef,
	usePersistedAgGridSession,
} from '../agGridDefaults';
import { useEntityCustomFieldDefs } from '../components/CustomFieldControl';
import { notifyError } from '../notify';

export function ContactsPage() {
	const isMobile = useMediaQuery(AG_GRID_MOBILE_MQ);
	const [newContactOpen, setNewContactOpen] = useState(false);
	const [editingContact, setEditingContact] = useState<Contact | null>(null);
	const [detailContactId, setDetailContactId] = useState<number | null>(null);
	const [contacts, setContacts] = useState<Contact[]>([]);
	const [loading, setLoading] = useState(true);

	const defaultColDef = useMemo(() => getDefaultColDef(isMobile), [isMobile]);
	const gridSession = usePersistedAgGridSession('contacts', !isMobile);
	const customFieldDefs = useEntityCustomFieldDefs('contact');
	const columnDefs = useMemo(
		() => [
			...contactColumnDefs,
			...entityCustomFieldColumnDefs<Contact>(customFieldDefs),
		],
		[customFieldDefs],
	);

	const refreshContacts = useCallback(async (signal?: AbortSignal) => {
		setLoading(true);
		try {
			const next = await listContacts(signal);
			if (!signal?.aborted) setContacts(next);
		} catch (err: unknown) {
			if (err instanceof DOMException && err.name === 'AbortError') return;
			notifyError(
				err instanceof Error ? err.message : 'Failed to load contacts',
			);
		} finally {
			if (!signal?.aborted) setLoading(false);
		}
	}, []);

	useEffect(() => {
		const controller = new AbortController();
		void refreshContacts(controller.signal);
		return () => controller.abort();
	}, [refreshContacts]);

	const handleSaveContact = async (values: NewContactFormValues) => {
		const payload = {
			name: values.name.trim(),
			title: values.title.trim() || undefined,
			phone: values.phone.trim() || undefined,
			email: values.email.trim() || undefined,
			customFields: values.customFields,
		};
		if (editingContact) {
			await updateContact(editingContact.id, payload);
		} else {
			await createContact(payload);
		}
		await refreshContacts();
	};

	const handleRowClicked = (event: RowClickedEvent<Contact>) => {
		if (event.data?.id != null) {
			setDetailContactId(event.data.id);
		}
	};

	const handleEditContact = (contact: Contact) => {
		setDetailContactId(null);
		setEditingContact(contact);
	};

	const handleDeleteContact = async (contact: Contact) => {
		await deleteContact(contact.id);
		setDetailContactId(null);
		await refreshContacts();
	};

	const handleCloseEditor = () => {
		setNewContactOpen(false);
		setEditingContact(null);
	};

	const editorInitialValues = useMemo<NewContactFormValues | null>(
		() =>
			editingContact
				? {
						name: editingContact.name,
						title: editingContact.title,
						phone: editingContact.phone,
						email: editingContact.email,
						customFields: { ...editingContact.customFields },
					}
				: null,
		[editingContact],
	);

	return (
		<Box className='tasks-page'>
			<PageHeader
				title='Contacts'
				right={
					<Button
						leftSection={<Plus size={18} />}
						onClick={() => {
							setEditingContact(null);
							setNewContactOpen(true);
						}}
						color='brand'
					>
						New Contact
					</Button>
				}
			/>

			<Box className='tasks-grid-wrap ag-theme-quartz'>
				{loading && contacts.length === 0 ? (
					<Group justify='center' py='xl'>
						<Loader size='sm' />
					</Group>
				) : (
					<AgGridProvider modules={[AllCommunityModule]}>
						<AgGridReact<Contact>
							rowData={contacts}
							columnDefs={columnDefs}
							defaultColDef={defaultColDef}
							getRowId={(p) => String(p.data.id)}
							rowHeight={isMobile ? 40 : undefined}
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

			<NewContactModal
				opened={newContactOpen || editingContact != null}
				onClose={handleCloseEditor}
				initialValues={editorInitialValues}
				onSave={handleSaveContact}
			/>

			<ContactDetailModal
				contactId={detailContactId}
				opened={detailContactId != null}
				onClose={() => setDetailContactId(null)}
				onEdit={handleEditContact}
				onDelete={handleDeleteContact}
			/>
		</Box>
	);
}
