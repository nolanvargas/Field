import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Button, Group, Loader, Box } from '@mantine/core';

import { useMediaQuery } from '@mantine/hooks';

import { Plus } from 'lucide-react';

import type { GridApi, RowClickedEvent } from 'ag-grid-community';

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

import { AgGridLayoutControls } from '../components/AgGridLayoutControls';

import {
	AG_GRID_MOBILE_MQ,
	CONTACT_COLUMN_OPTIONS,
	CONTACT_GRID_COLUMNS_STORAGE_KEY,
	buildEntityGridColumnDefs,
	contactColumnDefs,
	getDefaultColDef,
	useAdaptiveGridLayout,
	useBandedColumnWidthSaveBridge,
	useEntityGridColumnPicker,
	usePersistedAgGridSession,
} from '../agGridDefaults';

import { useGridForceFullWidth } from '../agGridLayoutPrefs';

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

	const [forceFullWidth, setForceFullWidth] = useGridForceFullWidth();

	const { userWidthsSaveRef, onUserColumnWidthsSettled } =
		useBandedColumnWidthSaveBridge();
	const adaptiveLayout = useAdaptiveGridLayout(!isMobile, {
		forceFullWidth,
		onUserColumnWidthsSettled,
	});

	const customFieldDefs = useEntityCustomFieldDefs('contact');

	const {
		visibleColumns,
		toggleColumn,
		builtinColumnOptions,
		customColumnOptions,
		columnVisibility,
	} = useEntityGridColumnPicker(
		CONTACT_GRID_COLUMNS_STORAGE_KEY,
		CONTACT_COLUMN_OPTIONS,
		customFieldDefs,
	);

	const gridSession = usePersistedAgGridSession(
		'contacts',
		!isMobile,
		adaptiveLayout,
		columnVisibility,
		userWidthsSaveRef,
	);

	const columnDefs = useMemo(
		() =>
			buildEntityGridColumnDefs(
				contactColumnDefs,
				customFieldDefs,
				visibleColumns,
				CONTACT_COLUMN_OPTIONS,
			),
		[customFieldDefs, visibleColumns],
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



	const gridApiRef = useRef<GridApi | null>(null);



	useEffect(() => {

		const api = gridApiRef.current;

		if (!api || isMobile) return;

		adaptiveLayout.apply(api, {
			debugReason: `forceFullWidth-toggle:${forceFullWidth}`,
		});

	}, [forceFullWidth, isMobile, adaptiveLayout.apply]);

	useEffect(() => {
		gridSession.onColumnDefsChanged(gridApiRef.current);
	}, [visibleColumns, gridSession.onColumnDefsChanged]);

	return (

		<Box className='tasks-page'>

			<PageHeader

				title='Contacts'

				right={

					<>

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

						{!isMobile ? (

							<AgGridLayoutControls
								forceFullWidth={forceFullWidth}
								onToggleForceFullWidth={() =>
									setForceFullWidth(!forceFullWidth)
								}
								columnOptions={{
									builtin: builtinColumnOptions,
									custom: customColumnOptions,
									visibleColumns,
									onToggleColumn: toggleColumn,
								}}
							/>

						) : null}

					</>

				}

			/>



			<Box ref={adaptiveLayout.shellRef} className='tasks-grid-shell'>

				<Box

					ref={adaptiveLayout.wrapRef}

					className='tasks-grid-wrap ag-theme-quartz'

					data-layout={adaptiveLayout.layoutMode}

				>

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

							initialState={gridSession.initialState}

							getRowId={(p) => String(p.data.id)}

							animateRows

							suppressCellFocus

							suppressHorizontalScroll

							rowStyle={{ cursor: 'pointer' }}

							onRowClicked={handleRowClicked}

							onGridReady={(e) => {

								gridApiRef.current = e.api;

								gridSession.onGridReady(e);

							}}

							onGridSizeChanged={gridSession.onGridSizeChanged}

							onFirstDataRendered={gridSession.onFirstDataRendered}

							onSortChanged={gridSession.onSortChanged}

							onFilterChanged={gridSession.onFilterChanged}

							onColumnResized={gridSession.onColumnResized}

						/>

					</AgGridProvider>

				)}

				</Box>

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


