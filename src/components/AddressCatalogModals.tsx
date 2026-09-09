import {
	forwardRef,
	useImperativeHandle,
	useMemo,
	useState,
} from 'react';
import {
	createAddress,
	deleteAddress,
	updateAddress,
	type Address,
} from '../api/addresses';
import { addressToFormValues, formValuesToAddressPayload } from '../addresses';
import { AddressDetailModal } from './AddressDetailModal';
import {
	NewAddressModal,
	type NewAddressFormValues,
} from './NewAddressModal';

export type AddressCatalogModalsProps = {
	allowAddAnother?: boolean;
	allowDelete?: boolean;
	zIndex?: number;
	onMutated?: () => void | Promise<void>;
};

export type AddressCatalogModalsHandle = {
	openDetail: (addressId: number) => void;
	openCreate: () => void;
	closeAll: () => void;
};

export const AddressCatalogModals = forwardRef<
	AddressCatalogModalsHandle,
	AddressCatalogModalsProps
>(function AddressCatalogModals(
	{ allowAddAnother = true, allowDelete = false, zIndex, onMutated },
	ref,
) {
	const [detailAddressId, setDetailAddressId] = useState<number | null>(null);
	const [editingAddress, setEditingAddress] = useState<Address | null>(null);
	const [createOpen, setCreateOpen] = useState(false);

	useImperativeHandle(ref, () => ({
		openDetail: (addressId) => setDetailAddressId(addressId),
		openCreate: () => {
			setEditingAddress(null);
			setCreateOpen(true);
		},
		closeAll: () => {
			setDetailAddressId(null);
			setEditingAddress(null);
			setCreateOpen(false);
		},
	}));

	const editorInitialValues = useMemo<NewAddressFormValues | null>(
		() => (editingAddress ? addressToFormValues(editingAddress) : null),
		[editingAddress],
	);

	const handleCloseEditor = () => {
		setCreateOpen(false);
		setEditingAddress(null);
	};

	const handleEditAddress = (address: Address) => {
		setDetailAddressId(null);
		setEditingAddress(address);
	};

	const handleSaveAddress = async (values: NewAddressFormValues) => {
		const payload = formValuesToAddressPayload(values);
		if (editingAddress) {
			await updateAddress(editingAddress.id, payload);
			setEditingAddress(null);
		} else {
			await createAddress(payload);
			setCreateOpen(false);
		}
		await onMutated?.();
	};

	const handleDeleteAddress = async (address: Address) => {
		await deleteAddress(address.id);
		setDetailAddressId(null);
		await onMutated?.();
	};

	return (
		<>
			<NewAddressModal
				opened={createOpen || editingAddress != null}
				onClose={handleCloseEditor}
				initialValues={editorInitialValues}
				editingAddressId={editingAddress?.id ?? null}
				allowAddAnother={allowAddAnother}
				zIndex={zIndex}
				onSave={handleSaveAddress}
			/>
			<AddressDetailModal
				addressId={detailAddressId}
				opened={detailAddressId != null}
				onClose={() => setDetailAddressId(null)}
				onEdit={handleEditAddress}
				onDelete={allowDelete ? handleDeleteAddress : undefined}
			/>
		</>
	);
});
