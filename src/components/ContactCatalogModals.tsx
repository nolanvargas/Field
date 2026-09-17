import {
	forwardRef,
	useImperativeHandle,
	useMemo,
	useState,
} from 'react';
import {
	createContact,
	deleteContact,
	updateContact,
	type Contact,
} from '../api/contacts';
import { ContactDetailModal } from './ContactDetailModal';
import {
	NewContactModal,
	type NewContactFormValues,
} from './NewContactModal';

export type ContactCatalogModalsProps = {
	allowAddAnother?: boolean;
	allowDelete?: boolean;
	zIndex?: number;
	onMutated?: () => void | Promise<void>;
};

export type ContactCatalogModalsHandle = {
	openDetail: (contactId: number) => void;
	openCreate: () => void;
	closeAll: () => void;
};

function contactToFormValues(contact: Contact): NewContactFormValues {
	return {
		name: contact.name,
		title: contact.title,
		phone: contact.phone,
		email: contact.email,
		customFields: { ...contact.customFields },
	};
}

function formValuesToContactPayload(values: NewContactFormValues) {
	return {
		name: values.name.trim(),
		title: values.title.trim() || undefined,
		phone: values.phone.trim() || undefined,
		email: values.email.trim() || undefined,
		customFields: values.customFields,
	};
}

export const ContactCatalogModals = forwardRef<
	ContactCatalogModalsHandle,
	ContactCatalogModalsProps
>(function ContactCatalogModals(
	{ allowAddAnother = true, allowDelete = false, zIndex, onMutated },
	ref,
) {
	const [detailContactId, setDetailContactId] = useState<number | null>(null);
	const [editingContact, setEditingContact] = useState<Contact | null>(null);
	const [createOpen, setCreateOpen] = useState(false);

	useImperativeHandle(ref, () => ({
		openDetail: (contactId) => setDetailContactId(contactId),
		openCreate: () => {
			setEditingContact(null);
			setCreateOpen(true);
		},
		closeAll: () => {
			setDetailContactId(null);
			setEditingContact(null);
			setCreateOpen(false);
		},
	}));

	const editorInitialValues = useMemo<NewContactFormValues | null>(
		() => (editingContact ? contactToFormValues(editingContact) : null),
		[editingContact],
	);

	const handleCloseEditor = () => {
		setCreateOpen(false);
		setEditingContact(null);
	};

	const handleEditContact = (contact: Contact) => {
		setDetailContactId(null);
		setEditingContact(contact);
	};

	const handleSaveContact = async (values: NewContactFormValues) => {
		const payload = formValuesToContactPayload(values);
		if (editingContact) {
			await updateContact(editingContact.id, payload);
			setEditingContact(null);
		} else {
			await createContact(payload);
			setCreateOpen(false);
		}
		await onMutated?.();
	};

	const handleDeleteContact = async (contact: Contact) => {
		await deleteContact(contact.id);
		setDetailContactId(null);
		await onMutated?.();
	};

	return (
		<>
			<NewContactModal
				opened={createOpen || editingContact != null}
				onClose={handleCloseEditor}
				initialValues={editorInitialValues}
				allowAddAnother={allowAddAnother}
				zIndex={zIndex}
				onSave={handleSaveContact}
			/>
			<ContactDetailModal
				contactId={detailContactId}
				opened={detailContactId != null}
				onClose={() => setDetailContactId(null)}
				onEdit={handleEditContact}
				onDelete={allowDelete ? handleDeleteContact : undefined}
				zIndex={zIndex}
			/>
		</>
	);
});
