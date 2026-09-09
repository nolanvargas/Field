import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Input, Popover, UnstyledButton } from '@mantine/core';
import {
	ORG_TASK_ICON_NAMES,
	resolveOrgTaskIcon,
	type OrgTaskIconName,
} from '../orgIcons';

type OrgTaskIconPickerProps = {
	value: string;
	onChange: (icon: OrgTaskIconName) => void;
	label?: string;
	/** Drops the visible label (grid header supplies it); still names the control. */
	hideLabel?: boolean;
};

export function OrgTaskIconPicker({
	value,
	onChange,
	label = 'Icon',
	hideLabel = false,
}: OrgTaskIconPickerProps) {
	const [opened, setOpened] = useState(false);
	const SelectedIcon = resolveOrgTaskIcon(value);
	const selectedName = (ORG_TASK_ICON_NAMES as readonly string[]).includes(value)
		? value
		: 'CircleHelp';

	return (
		<Input.Wrapper
			label={hideLabel ? undefined : label}
			className='org-task-icon-picker'
		>
			<Popover
				opened={opened}
				onChange={setOpened}
				position='bottom-start'
				withinPortal
			>
				<Popover.Target>
					<UnstyledButton
						type='button'
						className='org-task-icon-picker-trigger'
						aria-label={`${label}: ${selectedName}`}
						aria-haspopup='listbox'
						aria-expanded={opened}
						onClick={() => setOpened((o) => !o)}
					>
						<span className='org-task-icon-picker-trigger-icon-box'>
							<SelectedIcon aria-hidden className='org-task-icon-picker-trigger-icon' />
						</span>
						<span className='org-task-icon-picker-trigger-chevron' aria-hidden>
							<ChevronDown size={14} strokeWidth={2} />
						</span>
					</UnstyledButton>
				</Popover.Target>
				<Popover.Dropdown className='org-task-icon-picker-dropdown'>
					<div className='org-task-icon-picker-grid' role='listbox' aria-label={label}>
						{ORG_TASK_ICON_NAMES.map((name) => {
							const Icon = resolveOrgTaskIcon(name);
							const isSelected = name === selectedName;
							return (
								<UnstyledButton
									key={name}
									type='button'
									role='option'
									aria-selected={isSelected}
									className={
										isSelected
											? 'org-task-icon-picker-cell org-task-icon-picker-cell--selected'
											: 'org-task-icon-picker-cell'
									}
									aria-label={name}
									title={name}
									onClick={() => {
										onChange(name);
										setOpened(false);
									}}
								>
									<Icon aria-hidden className='org-task-icon-picker-cell-icon' />
								</UnstyledButton>
							);
						})}
					</div>
				</Popover.Dropdown>
			</Popover>
		</Input.Wrapper>
	);
}
