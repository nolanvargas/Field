import { Autocomplete } from '@mantine/core';
import {
	COMMON_TASK_TYPES,
	commonTaskTypeByName,
} from '../../shared/commonTaskTypes.js';

type TaskTypeNameComboboxProps = {
	value: string;
	usedNames: readonly string[];
	onNameChange: (name: string) => void;
	onPresetSelect: (preset: {
		name: string;
		pluralName: string;
		icon: string;
	}) => void;
	'aria-label'?: string;
};

export function TaskTypeNameCombobox({
	value,
	usedNames,
	onNameChange,
	onPresetSelect,
	'aria-label': ariaLabel = 'Task type name',
}: TaskTypeNameComboboxProps) {
	const usedLower = new Set(
		usedNames
			.map((name) => name.trim().toLowerCase())
			.filter((name) => name && name !== value.trim().toLowerCase()),
	);

	const options = COMMON_TASK_TYPES.filter(
		(preset) => !usedLower.has(preset.name.toLowerCase()),
	).map((preset) => preset.name);

	return (
		<Autocomplete
			aria-label={ariaLabel}
			placeholder='Type or pick a task type'
			data={options}
			value={value}
			onChange={onNameChange}
			onOptionSubmit={(name) => {
				const preset = commonTaskTypeByName(name);
				if (preset) {
					onPresetSelect(preset);
					return;
				}
				onNameChange(name);
			}}
		/>
	);
}
