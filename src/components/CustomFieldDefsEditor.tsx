import { Box, Button, Checkbox, Group, MultiSelect, Select, Text, TextInput, Title } from '@mantine/core';
import { Plus } from 'lucide-react';
import type { OrgCustomFieldDef } from '../api/orgSettings';
import { CustomFieldOptionsEditor } from './CustomFieldOptionsEditor';
import { SettingsGrid, type SettingsGridColumn } from './SettingsGrid';

const CUSTOM_FIELD_TYPE_GROUPS = [
	{
		group: 'Standard types',
		items: [
			{ value: 'text', label: 'Text' },
			{ value: 'number', label: 'Number' },
			{ value: 'boolean', label: 'Boolean' },
			{ value: 'date', label: 'Date' },
			{ value: 'select', label: 'Select' },
			{ value: 'multiselect', label: 'Multi-select' },
		],
	},
	{
		group: 'Lookup table',
		items: [
			{ value: 'lookup:users', label: 'Users' },
			{ value: 'lookup:contacts', label: 'Contacts' },
			{ value: 'lookup:addresses', label: 'Addresses' },
			{ value: 'lookup:tasks', label: 'Tasks' },
		],
	},
];

const BASE_CUSTOM_FIELD_COLUMNS: SettingsGridColumn[] = [
	{ key: 'slot', header: 'Slot', width: '2.75rem' },
	{ key: 'label', header: 'Label' },
	{ key: 'type', header: 'Type', width: '13rem' },
	{ key: 'options', header: 'Options', width: '14rem' },
	{ key: 'required', header: 'Required', width: '5.25rem', align: 'center' },
];

const SHOW_WHEN_COLUMN: SettingsGridColumn = {
	key: 'showWhen',
	header: 'Show when',
	width: '16rem',
};

type CustomFieldDefsEditorProps = {
	title: string;
	description: string;
	defs: OrgCustomFieldDef[];
	taskTypeNames?: string[];
	onAdd: () => void;
	onRemove: (slot: number) => void;
	onUpdate: (slot: number, patch: Partial<OrgCustomFieldDef>) => void;
};

export function CustomFieldDefsEditor({
	title,
	description,
	defs,
	taskTypeNames,
	onAdd,
	onRemove,
	onUpdate,
}: CustomFieldDefsEditorProps) {
	const sorted = [...defs].sort((a, b) => a.slot - b.slot);
	const showWhenEnabled = Array.isArray(taskTypeNames);
	const columns = showWhenEnabled
		? [...BASE_CUSTOM_FIELD_COLUMNS, SHOW_WHEN_COLUMN]
		: BASE_CUSTOM_FIELD_COLUMNS;

	return (
		<Box>
			<Group justify='space-between' mb='sm'>
				<Title order={4}>{title}</Title>
				<Button variant='light' leftSection={<Plus size={14} />} onClick={onAdd}>
					Add field
				</Button>
			</Group>
			<Text size='sm' c='dimmed' mb='sm'>
				{description}
			</Text>
			<SettingsGrid
				label={title}
				columns={columns}
				onRemove={(index) => {
					const def = sorted[index];
					if (def) onRemove(def.slot);
				}}
				emptyMessage='No custom fields yet. Add one to get started.'
				rows={sorted.map((def) => {
					const slot = def.slot;
					return {
						key: `slot-${slot}`,
						label: def.label || `slot ${slot}`,
						cells: {
							slot: (
								<Text size='sm' c='dimmed'>
									{slot}
								</Text>
							),
							label: (
								<TextInput
									aria-label={`Slot ${slot} label`}
									value={def.label}
									onChange={(e) =>
										onUpdate(slot, { label: e.currentTarget.value })
									}
								/>
							),
							type: (
								<Select
									aria-label={`Slot ${slot} type`}
									data={CUSTOM_FIELD_TYPE_GROUPS}
									value={
										def.dataType === 'lookup'
											? `lookup:${def.lookupTable || 'contacts'}`
											: def.dataType
									}
									onChange={(v) => {
										if (v?.startsWith('lookup:')) {
											onUpdate(slot, {
												dataType: 'lookup',
												lookupTable: v.slice('lookup:'.length),
											});
										} else {
											const dataType =
												(v as OrgCustomFieldDef['dataType']) ?? 'text';
											onUpdate(slot, {
												dataType,
												lookupTable: null,
												options:
													dataType === 'select' || dataType === 'multiselect'
														? (def.options ?? [])
														: [],
											});
										}
									}}
								/>
							),
							required: (
								<Checkbox
									aria-label={`Slot ${slot} required`}
									checked={def.required}
									onChange={(e) =>
										onUpdate(slot, { required: e.currentTarget.checked })
									}
								/>
							),
							options: (
								<CustomFieldOptionsEditor
									value={def.options ?? []}
									onChange={(options) => onUpdate(slot, { options })}
									disabled={
										def.dataType !== 'select' && def.dataType !== 'multiselect'
									}
									fieldLabel={def.label || `Slot ${slot}`}
									slot={slot}
								/>
							),
							...(showWhenEnabled
								? {
										showWhen: (
											<Box maw={240}>
												<MultiSelect
													aria-label={`Slot ${slot} show when`}
													data={taskTypeNames}
													value={def.showWhen?.taskTypeNames ?? []}
													onChange={(names) =>
														onUpdate(slot, {
															showWhen:
																names.length > 0
																	? { taskTypeNames: names }
																	: null,
														})
													}
													placeholder='Always'
													searchable
													clearable
													hidePickedOptions
												/>
											</Box>
										),
									}
								: {}),
						},
					};
				})}
			/>
		</Box>
	);
}
