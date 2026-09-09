import { useEffect, useState } from 'react';
import { Stack, Group, TextInput, Button } from '@mantine/core';
import { Mail, Phone, Save, UserRound, Briefcase, X, Plus } from 'lucide-react';
import { KeyboardAwareModal } from './KeyboardAwareModal';
import { entityModalHeaderStyles } from './entityModalHeaderStyles';
import {
	CustomFieldStack,
	useCustomFieldLookups,
	useEntityCustomFieldDefs,
} from './CustomFieldControl';
import { requiredCustomFieldError, type CustomFieldValues } from '../customFields';
import type { CustomFieldValue } from '../types/task';
import { notifyError } from '../notify';

export interface NewContactFormValues {
	name: string;
	title: string;
	phone: string;
	email: string;
	customFields: CustomFieldValues;
}

function createEmptyForm(): NewContactFormValues {
	return { name: '', title: '', phone: '', email: '', customFields: {} };
}

interface NewContactModalProps {
	opened: boolean;
	onClose: () => void;
	/** When set, modal is in edit mode and form is seeded from these values. */
	initialValues?: NewContactFormValues | null;
	/** Override create vs edit. Defaults to true when initialValues is set. */
	isEdit?: boolean;
	/** When false, hides Save & Add Another (e.g. nested from task modal). */
	allowAddAnother?: boolean;
	/** Passed through to Mantine Modal (use when nesting above another modal). */
	zIndex?: number;
	onSave?: (
		values: NewContactFormValues,
		addAnother: boolean,
	) => void | Promise<void>;
}

const inputSize = 'sm' as const;

export function NewContactModal({
	opened,
	onClose,
	initialValues = null,
	isEdit: isEditProp,
	allowAddAnother = true,
	zIndex,
	onSave,
}: NewContactModalProps) {
	const isEdit = isEditProp ?? initialValues != null;
	const [form, setForm] = useState<NewContactFormValues>(createEmptyForm);
	const [saving, setSaving] = useState(false);
	const customFieldDefs = useEntityCustomFieldDefs('contact');
	const { catalogs, loading } = useCustomFieldLookups(customFieldDefs, opened);

	useEffect(() => {
		if (!opened) return;
		setForm(initialValues ? { ...initialValues } : createEmptyForm());
	}, [opened, initialValues]);

	const update = <K extends keyof NewContactFormValues>(
		key: K,
		value: NewContactFormValues[K],
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

	const handleSave = async (addAnother: boolean) => {
		if (saving) return;
		if (!form.name.trim()) {
			notifyError('Name is required');
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
				err instanceof Error ? err.message : 'Failed to save contact',
			);
		} finally {
			setSaving(false);
		}
	};

	return (
		<KeyboardAwareModal
			opened={opened}
			onClose={handleClose}
			title={isEdit ? 'Edit Contact' : 'New Contact'}
			size='lg'
			centered
			zIndex={zIndex}
			closeOnClickOutside={false}
			closeOnEscape={!saving}
			styles={entityModalHeaderStyles}
		>
			<Stack gap={6} maw={560}>
				<TextInput
					size={inputSize}
					label='Name'
					placeholder='Contact name'
					value={form.name}
					onChange={(e) => update('name', e.currentTarget.value)}
					leftSection={<UserRound size={16} />}
					required
					disabled={saving}
					data-autofocus
				/>
				<TextInput
					size={inputSize}
					label='Title'
					placeholder='e.g. Manager, Front Desk, etc.'
					value={form.title}
					onChange={(e) => update('title', e.currentTarget.value)}
					leftSection={<Briefcase size={16} />}
					disabled={saving}
				/>
				<TextInput
					size={inputSize}
					label='Phone'
					placeholder='Phone number'
					value={form.phone}
					onChange={(e) => update('phone', e.currentTarget.value)}
					leftSection={<Phone size={16} />}
					disabled={saving}
				/>
				<TextInput
					size={inputSize}
					label='Email'
					placeholder='Email address'
					value={form.email}
					onChange={(e) => update('email', e.currentTarget.value)}
					leftSection={<Mail size={16} />}
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
	);
}
