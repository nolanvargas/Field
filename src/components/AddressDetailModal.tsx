import { useEffect, useState } from 'react';
import {
	Stack,
	Group,
	SimpleGrid,
	Loader,
	Alert,
	Button,
} from '@mantine/core';
import { Pencil, Trash2, MapPin, ExternalLink } from 'lucide-react';
import { getAddress, type Address } from '../api/addresses';
import { useAlert } from '../context/AlertContext';
import { notifyError } from '../notify';
import { AddressPinModal } from './AddressPinModal';
import { AddressMapPreview } from './AddressMapPreview';
import { KeyboardAwareModal } from './KeyboardAwareModal';
import { DetailField } from './DetailField';
import { entityModalHeaderStyles } from './entityModalHeaderStyles';
import { useEntityCustomFieldDefs } from './CustomFieldControl';
import { customFieldDetailRows } from './CustomFieldValueText';
import { hasDestinationCoords } from '../../shared/destinationCoords.js';
import {
	mapsPlatform,
	openMapsNavigationCoords,
} from '../openMapsNavigation';
interface AddressDetailModalProps {
	addressId: number | null;
	opened: boolean;
	onClose: () => void;
	onEdit?: (address: Address) => void;
	onDelete?: (address: Address) => Promise<void>;
}

export function AddressDetailModal({
	addressId,
	opened,
	onClose,
	onEdit,
	onDelete,
}: AddressDetailModalProps) {
	const { confirm } = useAlert();
	const [address, setAddress] = useState<Address | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [deleting, setDeleting] = useState(false);
	const [pinOpen, setPinOpen] = useState(false);
	const customFieldDefs = useEntityCustomFieldDefs('address');

	useEffect(() => {
		if (!opened || addressId == null) {
			setAddress(null);
			setError(null);
			setLoading(false);
			setDeleting(false);
			return;
		}

		const controller = new AbortController();
		setLoading(true);
		setError(null);
		setAddress(null);

		getAddress(addressId, controller.signal)
			.then((next) => {
				if (!controller.signal.aborted) setAddress(next);
			})
			.catch((err: unknown) => {
				if (err instanceof DOMException && err.name === 'AbortError') return;
				setError(err instanceof Error ? err.message : 'Failed to load address');
			})
			.finally(() => {
				if (!controller.signal.aborted) setLoading(false);
			});

		return () => controller.abort();
	}, [opened, addressId]);

	const handleDelete = async () => {
		if (!address || !onDelete) return;
		const label = address.addressName || address.streetLine || `#${address.id}`;
		if (!(await confirm(`Delete address “${label}”?`, { danger: true }))) {
			return;
		}
		setDeleting(true);
		try {
			await onDelete(address);
		} catch (err: unknown) {
			notifyError(
				err instanceof Error ? err.message : 'Failed to delete address',
			);
			setDeleting(false);
		}
	};

	const title =
		address?.addressName ||
		address?.streetLine ||
		(addressId != null ? `Address #${addressId}` : 'Address');

	const hasCoords = address ? hasDestinationCoords(address) : false;
	const opensMapsTab = hasCoords && mapsPlatform() === 'web';
	const coords =
		address?.latitude != null && address.longitude != null
			? { latitude: address.latitude, longitude: address.longitude }
			: null;

	const streetValue =
		address && hasCoords && address.streetLine.trim() && coords ? (
			<button
				type='button'
				className='task-detail-destination-map-link'
				title={opensMapsTab ? 'Open in Maps (new tab)' : 'Open in Maps'}
				onClick={() => openMapsNavigationCoords(coords)}
			>
				<span className='task-detail-destination-map-link-text'>
					{address.streetLine}
				</span>
				{opensMapsTab ? (
					<ExternalLink
						size={13}
						strokeWidth={2.25}
						className='task-detail-destination-map-link-icon'
						aria-hidden
					/>
				) : null}
			</button>
		) : (
			address?.streetLine
		);

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
				<Alert color='red' title='Could not load address'>
					{error}
				</Alert>
			) : address ? (
				<Stack gap='md'>
					{coords ? (
						<AddressMapPreview center={[coords.latitude, coords.longitude]} />
					) : null}
					<SimpleGrid cols={{ base: 1, sm: 2 }} spacing='sm'>
						<DetailField label='Name' value={address.addressName} />
						<DetailField label='Street' value={streetValue} span={2} />
						<DetailField label='Building' value={address.building} />
						<DetailField label='Notes' value={address.notes} span={2} />
						{!hasCoords ? (
							<DetailField
								label='Location'
								value='Location missing'
								span={2}
							/>
						) : null}
						{customFieldDetailRows(customFieldDefs, address, (row) => (
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
							{!hasCoords ? (
								<Button
									variant='light'
									leftSection={<MapPin size={16} />}
									onClick={() => setPinOpen(true)}
									disabled={deleting}
								>
									Geo-locate
								</Button>
							) : null}
							<Button variant='default' onClick={onClose} disabled={deleting}>
								Close
							</Button>
							{onEdit ? (
								<Button
									color='brand'
									leftSection={<Pencil size={16} />}
									onClick={() => onEdit(address)}
									disabled={deleting}
								>
									Edit
								</Button>
							) : null}
						</Group>
					</Group>
				</Stack>
			) : null}
			{address ? (
				<AddressPinModal
					mode='address'
					id={address.id}
					label={address.addressName || address.streetLine}
					addressName={address.addressName}
					streetLine={address.streetLine}
					building={address.building}
					opened={pinOpen}
					onClose={() => setPinOpen(false)}
					onSaved={async () => {
						const refreshed = await getAddress(address.id);
						setAddress(refreshed);
					}}
				/>
			) : null}
		</KeyboardAwareModal>
	);
}
