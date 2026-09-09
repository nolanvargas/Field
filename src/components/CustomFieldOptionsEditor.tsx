import { useCallback, useState } from 'react';
import {
	Button,
	Group,
	Stack,
	Text,
	TextInput,
	UnstyledButton,
} from '@mantine/core';
import { ChevronDown, Plus } from 'lucide-react';
import {
	formatCustomFieldOptionsSummary,
	normalizeCustomFieldOptions,
} from '../customFields';
import { KeyboardAwareModal } from './KeyboardAwareModal';
import {
	SettingsGrid,
	type SettingsGridColumn,
} from './SettingsGrid';

const OPTION_COLUMNS: SettingsGridColumn[] = [
	{ key: 'label', header: 'Option' },
];

type CustomFieldOptionsEditorProps = {
	value: string[];
	onChange: (options: string[]) => void;
	disabled?: boolean;
	fieldLabel: string;
	slot: number;
};

export function CustomFieldOptionsEditor({
	value,
	onChange,
	disabled = false,
	fieldLabel,
	slot,
}: CustomFieldOptionsEditorProps) {
	const [opened, setOpened] = useState(false);
	const [draftOptions, setDraftOptions] = useState<string[]>([]);

	const summary = formatCustomFieldOptionsSummary(value);
	const ariaLabel = `Options for ${fieldLabel} (slot ${slot}): ${summary}`;

	const openModal = useCallback(() => {
		if (disabled) return;
		setDraftOptions(value.length > 0 ? [...value] : ['']);
		setOpened(true);
	}, [disabled, value]);

	const closeModal = useCallback(() => {
		setOpened(false);
	}, []);

	const addOption = useCallback(() => {
		setDraftOptions((prev) => [...prev, '']);
	}, []);

	const updateOptionAt = useCallback((index: number, label: string) => {
		setDraftOptions((prev) =>
			prev.map((option, i) => (i === index ? label : option)),
		);
	}, []);

	const removeOption = useCallback((index: number) => {
		setDraftOptions((prev) => prev.filter((_, i) => i !== index));
	}, []);

	const moveOption = useCallback((index: number, direction: -1 | 1) => {
		setDraftOptions((prev) => {
			const next = [...prev];
			const target = index + direction;
			if (target < 0 || target >= next.length) return prev;
			[next[index], next[target]] = [next[target], next[index]];
			return next;
		});
	}, []);

	const handleDone = useCallback(() => {
		onChange(normalizeCustomFieldOptions(draftOptions));
		closeModal();
	}, [closeModal, draftOptions, onChange]);

	return (
		<>
			<UnstyledButton
				type='button'
				className='field-custom-field-options-trigger'
				data-empty={value.length === 0 || undefined}
				disabled={disabled}
				aria-label={ariaLabel}
				aria-haspopup='dialog'
				aria-expanded={opened}
				onClick={openModal}
			>
				<span className='field-custom-field-options-trigger-label'>{summary}</span>
				<span className='field-custom-field-options-trigger-chevron' aria-hidden>
					<ChevronDown size={14} strokeWidth={2} />
				</span>
			</UnstyledButton>

			<KeyboardAwareModal
				opened={opened}
				onClose={closeModal}
				title={`Options — ${fieldLabel}`}
				size='md'
			>
				<Stack gap='md'>
					<Group justify='space-between'>
						<Text size='sm' c='dimmed'>
							Choices shown on task forms for this field.
						</Text>
						<Button
							variant='light'
							leftSection={<Plus size={14} />}
							onClick={addOption}
						>
							Add option
						</Button>
					</Group>

					<SettingsGrid
						label={`Options for ${fieldLabel}`}
						columns={OPTION_COLUMNS}
						actionIconSize='md'
						onMove={moveOption}
						onRemove={removeOption}
						emptyMessage='No options yet. Add one to get started.'
						rows={draftOptions.map((option, index) => ({
							key: `option-${index}`,
							label: option || `option ${index + 1}`,
							cells: {
								label: (
									<TextInput
										aria-label={`Option ${index + 1}`}
										placeholder='Option label'
										value={option}
										onChange={(e) =>
											updateOptionAt(index, e.currentTarget.value)
										}
									/>
								),
							},
						}))}
					/>

					<Group justify='flex-end'>
						<Button variant='default' onClick={closeModal}>
							Cancel
						</Button>
						<Button onClick={handleDone}>Done</Button>
					</Group>
				</Stack>
			</KeyboardAwareModal>
		</>
	);
}
