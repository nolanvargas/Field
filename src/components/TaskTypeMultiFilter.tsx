import { Combobox, Group, InputBase, useCombobox } from '@mantine/core';
import { Check } from 'lucide-react';
import { resolveOrgTaskIcon } from '../orgIcons';

export type TaskTypeMultiFilterOption = {
	value: string;
	label: string;
	icon?: string;
};

type TaskTypeMultiFilterProps = {
	value: string[];
	onChange: (value: string[]) => void;
	options: TaskTypeMultiFilterOption[];
	width?: number | string;
	'aria-label'?: string;
};

function FilterValue({
	value,
	options,
}: {
	value: string[];
	options: TaskTypeMultiFilterOption[];
}) {
	if (value.length === 0) {
		return <span className='task-type-multi-filter-placeholder'>All types</span>;
	}
	if (value.length === 1) {
		const opt = options.find((o) => o.value === value[0]);
		const Icon = resolveOrgTaskIcon(opt?.icon);
		return (
			<Group
				gap={8}
				wrap='nowrap'
				className='task-type-multi-filter-value'
				fz='sm'
			>
				<Icon size={16} aria-hidden />
				<span className='task-type-multi-filter-label'>{opt?.label}</span>
			</Group>
		);
	}
	return (
		<Group gap={4} wrap='nowrap' className='task-type-multi-filter-value'>
			{value.map((name) => {
				const opt = options.find((o) => o.value === name);
				const Icon = resolveOrgTaskIcon(opt?.icon);
				return <Icon key={name} size={16} aria-hidden />;
			})}
		</Group>
	);
}

export function TaskTypeMultiFilter({
	value,
	onChange,
	options,
	width = 160,
	'aria-label': ariaLabel = 'Filter tasks by type',
}: TaskTypeMultiFilterProps) {
	const combobox = useCombobox({
		onDropdownClose: () => combobox.resetSelectedOption(),
	});

	const selected = new Set(value);

	const toggle = (typeName: string) => {
		if (selected.has(typeName)) {
			onChange(value.filter((v) => v !== typeName));
		} else {
			onChange([...value, typeName]);
		}
	};

	return (
		<Combobox
			store={combobox}
			withinPortal
			position='bottom-start'
			shadow='md'
			classNames={{
				dropdown: 'task-type-multi-filter-dropdown',
				option: 'task-type-multi-filter-option',
			}}
			onOptionSubmit={(optionValue) => {
				if (optionValue === '__all__') {
					onChange([]);
					combobox.closeDropdown();
					return;
				}
				toggle(optionValue);
			}}
		>
			<Combobox.Target>
				<InputBase
					component='button'
					type='button'
					pointer
					w={width}
					aria-label={ariaLabel}
					classNames={{ input: 'task-type-multi-filter-input' }}
					rightSection={<Combobox.Chevron />}
					rightSectionPointerEvents='none'
					onClick={() => combobox.toggleDropdown()}
				>
					<FilterValue value={value} options={options} />
				</InputBase>
			</Combobox.Target>

			<Combobox.Dropdown>
				<Combobox.Options>
					<Combobox.Option
						value='__all__'
						selected={value.length === 0}
					>
						<Group gap={8} wrap='nowrap'>
							<span
								className='task-type-multi-filter-option-check'
								aria-hidden
							>
								{value.length === 0 ? (
									<Check size={14} strokeWidth={2.5} />
								) : null}
							</span>
							<span>All types</span>
						</Group>
					</Combobox.Option>
					{options.map((opt) => {
						const Icon = resolveOrgTaskIcon(opt.icon);
						const isSelected = selected.has(opt.value);
						return (
							<Combobox.Option
								key={opt.value}
								value={opt.value}
								selected={isSelected}
							>
								<Group gap={8} wrap='nowrap'>
									<span
										className='task-type-multi-filter-option-check'
										aria-hidden
									>
										{isSelected ? (
											<Check size={14} strokeWidth={2.5} />
										) : null}
									</span>
									<Icon size={16} aria-hidden />
									<span>{opt.label}</span>
								</Group>
							</Combobox.Option>
						);
					})}
				</Combobox.Options>
			</Combobox.Dropdown>
		</Combobox>
	);
}
