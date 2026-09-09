import { useEffect, useMemo, useState } from 'react';
import {
	Stack,
	Group,
	TextInput,
	Textarea,
	Button,
	ActionIcon,
	Box,
	Tooltip,
} from '@mantine/core';
import { Building2, MapPin, Save, StickyNote, X, Plus } from 'lucide-react';
import { getAddress } from '../api/addresses';
import {
	AddressPlaceInput,
	type ResolvedPlace,
} from './AddressPlaceInput';
import { AddressPinModal } from './AddressPinModal';
import { KeyboardAwareModal } from './KeyboardAwareModal';
import { entityModalHeaderStyles } from './entityModalHeaderStyles';
import {
	CustomFieldStack,
	useCustomFieldLookups,
	useEntityCustomFieldDefs,
} from './CustomFieldControl';
import { requiredCustomFieldError, type CustomFieldValues } from '../customFields';
import type { CustomFieldValue } from '../types/task';
import { hasDestinationCoords } from '../../shared/destinationCoords.js';
import { notifyError } from '../notify';

export interface NewAddressFormValues {
	addressName: string;
	streetLine: string;
	building: string;
	notes: string;
	latitude: number | null;
	longitude: number | null;
	googlePlaceId: string | null;
	customFields: CustomFieldValues;
}

function createEmptyForm(): NewAddressFormValues {
	return {
		addressName: '',
		streetLine: '',
		building: '',
		notes: '',
		latitude: null,
		longitude: null,
		googlePlaceId: null,
		customFields: {},
	};
}

interface NewAddressModalProps {
	opened: boolean;
	onClose: () => void;
	/** When set, modal is in edit mode and form is seeded from these values. */
	initialValues?: NewAddressFormValues | null;
	/** Override create vs edit. Defaults to true when initialValues is set. */
	isEdit?: boolean;
	/** Catalog row id when editing (for Geo-locate). */
	editingAddressId?: number | null;
	/** When false, hides Save & Add Another (e.g. nested from task modal). */
	allowAddAnother?: boolean;
	/** Passed through to Mantine Modal (use when nesting above another modal). */
	zIndex?: number;
	onSave?: (
		values: NewAddressFormValues,
		addAnother: boolean,
	) => void | Promise<void>;
}

const inputSize = 'sm' as const;

export function NewAddressModal({
	opened,
	onClose,
	initialValues = null,
	isEdit: isEditProp,
	editingAddressId = null,
	allowAddAnother = true,
	zIndex,
	onSave,
}: NewAddressModalProps) {
	const isEdit = isEditProp ?? initialValues != null;
	const [form, setForm] = useState<NewAddressFormValues>(createEmptyForm);
	const [pinOpen, setPinOpen] = useState(false);
	const [saving, setSaving] = useState(false);
	const customFieldDefs = useEntityCustomFieldDefs('address');
	const { catalogs, loading } = useCustomFieldLookups(customFieldDefs, opened);

	const initialResolved = useMemo<ResolvedPlace | null>(() => {
		if (
			initialValues?.latitude != null &&
			initialValues.longitude != null &&
			initialValues.googlePlaceId
		) {
			return {
				streetLine: initialValues.streetLine,
				addressName: initialValues.addressName || undefined,
				latitude: initialValues.latitude,
				longitude: initialValues.longitude,
				googlePlaceId: initialValues.googlePlaceId,
				formattedAddress: initialValues.streetLine,
			};
		}
		return null;
	}, [initialValues]);

	useEffect(() => {
		if (!opened) return;
		setForm(initialValues ? { ...initialValues } : createEmptyForm());
	}, [opened, initialValues, initialResolved]);

	const update = <K extends keyof NewAddressFormValues>(
		key: K,
		value: NewAddressFormValues[K],
	) => {
		setForm((prev) => ({ ...prev, [key]: value }));
	};

	const updateCustomField = (slot: number, value: CustomFieldValue) => {
		setForm((prev) => ({
			...prev,
			customFields: { ...prev.customFields, [String(slot)]: value },
		}));
	};

	const reset = () => {
		setForm(initialValues ? { ...initialValues } : createEmptyForm());
	};

	const handleClose = () => {
		if (saving) return;
		reset();
		onClose();
	};

	const applyResolved = (place: ResolvedPlace | null) => {
		if (!place) {
			setForm((prev) => ({
				...prev,
				latitude: null,
				longitude: null,
				googlePlaceId: null,
			}));
			return;
		}
		setForm((prev) => ({
			...prev,
			streetLine: place.streetLine,
			addressName: place.addressName ?? prev.addressName,
			latitude: place.latitude,
			longitude: place.longitude,
			googlePlaceId: place.googlePlaceId,
		}));
	};

	const hasCoords = hasDestinationCoords(form);

	const handleSave = async (addAnother: boolean) => {
		if (saving) return;
		if (!form.streetLine.trim()) {
			notifyError('Street is required');
			return;
		}
		if (!hasCoords) {
			notifyError('Select a suggested address or use Geo-locate to set a pin');
			return;
		}
		const missing = requiredCustomFieldError(form.customFields, customFieldDefs);
		if (missing) {
			notifyError(missing);
			return;
		}
		setSaving(true);
		try {
			await onSave?.(form, addAnother);
			if (addAnother) {
				setForm(createEmptyForm());
			} else {
				reset();
				onClose();
			}
		} catch (err: unknown) {
			notifyError(
				err instanceof Error ? err.message : 'Failed to save address',
			);
		} finally {
			setSaving(false);
		}
	};

	const locationLabel =
		form.addressName.trim() || form.streetLine.trim() || 'Address';
	const canGeoLocate = Boolean(
		form.streetLine.trim() || form.addressName.trim(),
	);
	const pinZIndex = zIndex != null ? zIndex + 10 : undefined;

	return (
		<>
			<KeyboardAwareModal
				opened={opened}
				onClose={handleClose}
				title={isEdit ? 'Edit Address' : 'New Address'}
				size='lg'
				centered
				zIndex={zIndex}
				closeOnClickOutside={false}
				closeOnEscape={!saving}
				styles={entityModalHeaderStyles}
			>
				<Stack gap={6} maw={560} w='100%' mx='auto'>
					<TextInput
						size={inputSize}
						label='Name'
						placeholder='Venue / location name'
						value={form.addressName}
						onChange={(e) => update('addressName', e.currentTarget.value)}
						leftSection={<MapPin size={16} />}
						disabled={saving}
						data-autofocus
					/>
					<Group gap={6} align='flex-end' wrap='nowrap'>
						<Box style={{ flex: 1 }}>
							<AddressPlaceInput
								streetLine={form.streetLine}
								addressName={form.addressName}
								building={form.building}
								disabled={saving}
								required
								initialResolved={initialResolved}
								onStreetLineChange={(value) => update('streetLine', value)}
								onResolved={applyResolved}
							/>
						</Box>
						<Tooltip label='Geo-locate'>
							<ActionIcon
								size={36}
								variant='light'
								onClick={() => setPinOpen(true)}
								disabled={!canGeoLocate || saving}
								aria-label='Geo-locate'
							>
								<MapPin size={18} />
							</ActionIcon>
						</Tooltip>
					</Group>
					<TextInput
						size={inputSize}
						label='Building'
						placeholder='Building / suite'
						value={form.building}
						onChange={(e) => update('building', e.currentTarget.value)}
						leftSection={<Building2 size={16} />}
						disabled={saving}
					/>
					<Textarea
						size={inputSize}
						label='Notes'
						placeholder='Access notes'
						value={form.notes}
						onChange={(e) => update('notes', e.currentTarget.value)}
						leftSection={<StickyNote size={16} />}
						leftSectionProps={{
							style: { alignItems: 'flex-start', paddingTop: 10 },
						}}
						minRows={2}
						autosize
						disabled={saving}
					/>
					<CustomFieldStack
						defs={customFieldDefs}
						values={form.customFields}
						onChange={updateCustomField}
						disabled={saving}
						catalogs={catalogs}
						loading={loading}
					/>

					<Group justify='flex-end' gap={6} mt={4} wrap='nowrap'>
						<Button
							size='sm'
							variant='default'
							leftSection={<X size={16} />}
							onClick={handleClose}
							disabled={saving}
						>
							Close
						</Button>
						{!isEdit && allowAddAnother ? (
							<Button
								size='sm'
								variant='default'
								leftSection={<Plus size={16} />}
								onClick={() => void handleSave(true)}
								loading={saving}
							>
								Save & Add Another
							</Button>
						) : null}
						<Button
							size='sm'
							color='brand'
							leftSection={<Save size={16} />}
							onClick={() => void handleSave(false)}
							loading={saving}
						>
							{isEdit ? 'Save' : 'Save & Close'}
						</Button>
					</Group>
				</Stack>
			</KeyboardAwareModal>
			{editingAddressId != null ? (
				<AddressPinModal
					mode='address'
					id={editingAddressId}
					label={locationLabel}
					addressName={form.addressName}
					streetLine={form.streetLine}
					building={form.building}
					initialLatitude={form.latitude}
					initialLongitude={form.longitude}
					opened={pinOpen}
					onClose={() => setPinOpen(false)}
					zIndex={pinZIndex}
					onSaved={async () => {
						const refreshed = await getAddress(editingAddressId);
						setForm((prev) => ({
							...prev,
							addressName: refreshed.addressName,
							streetLine: refreshed.streetLine,
							building: refreshed.building,
							notes: refreshed.notes,
							latitude: refreshed.latitude,
							longitude: refreshed.longitude,
							googlePlaceId: refreshed.googlePlaceId,
						}));
					}}
				/>
			) : (
				<AddressPinModal
					mode='draft'
					label={locationLabel}
					addressName={form.addressName}
					streetLine={form.streetLine}
					building={form.building}
					initialLatitude={form.latitude}
					initialLongitude={form.longitude}
					opened={pinOpen}
					onClose={() => setPinOpen(false)}
					zIndex={pinZIndex}
					onSaved={(latitude, longitude, googlePlaceId = null) => {
						setForm((prev) => ({
							...prev,
							latitude,
							longitude,
							googlePlaceId,
						}));
					}}
				/>
			)}
		</>
	);
}
