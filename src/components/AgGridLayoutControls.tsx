import {
	Button,
	Checkbox,
	Menu,
	Tooltip,
} from '@mantine/core';
import { Settings } from 'lucide-react';

type ColumnOption = {
	field: string;
	headerName: string;
	required?: boolean;
};

type AgGridLayoutControlsColumnOptions = {
	builtin: ColumnOption[];
	custom: ColumnOption[];
	visibleColumns: string[];
	onToggleColumn: (field: string, checked: boolean) => void;
	/** When set, overrides `visibleColumns.includes` for checkbox state. */
	isColumnVisible?: (field: string) => boolean;
};

type AgGridLayoutControlsProps = {
	forceFullWidth?: boolean;
	onToggleForceFullWidth?: () => void;
	columnOptions?: AgGridLayoutControlsColumnOptions;
	compact?: boolean;
	onToggleCompact?: () => void;
	/** When false, hide the full-width table layout toggle (mobile card settings). */
	showFullWidth?: boolean;
	settingsLabel?: string;
};

export function AgGridLayoutControls({
	forceFullWidth = false,
	onToggleForceFullWidth,
	columnOptions,
	compact = false,
	onToggleCompact,
	showFullWidth = true,
	settingsLabel,
}: AgGridLayoutControlsProps) {
	const tooltip =
		settingsLabel ??
		(showFullWidth ? 'Table settings' : 'Card settings');

	return (
		<Menu shadow='md' width={220} closeOnItemClick={false}>
			<Tooltip label={tooltip}>
				<Menu.Target>
					<Button
						variant='default'
						aria-label={tooltip}
						className='field-ag-grid-settings-btn'
					>
						<Settings size={18} />
					</Button>
				</Menu.Target>
			</Tooltip>
			<Menu.Dropdown>
				{showFullWidth && onToggleForceFullWidth ? (
					<>
						<Menu.Label>Layout</Menu.Label>
						<Menu.Item component='div'>
							<Checkbox
								label='Full width'
								checked={forceFullWidth}
								onChange={() => onToggleForceFullWidth()}
							/>
						</Menu.Item>
					</>
				) : null}
				{onToggleCompact ? (
					<>
						{showFullWidth && onToggleForceFullWidth ? (
							<Menu.Divider />
						) : (
							<Menu.Label>Layout</Menu.Label>
						)}
						<Menu.Item component='div'>
							<Checkbox
								label='Compact'
								checked={compact}
								onChange={() => onToggleCompact()}
							/>
						</Menu.Item>
					</>
				) : null}
				{columnOptions ? (
					<>
						<Menu.Divider />
						<Menu.Label>Columns</Menu.Label>
						{columnOptions.builtin.map((option) => (
							<Menu.Item key={option.field} component='div'>
								<Checkbox
									label={option.headerName}
									checked={
										columnOptions.isColumnVisible
											? columnOptions.isColumnVisible(option.field)
											: columnOptions.visibleColumns.includes(option.field)
									}
									disabled={option.required}
									onChange={(e) =>
										columnOptions.onToggleColumn(
											option.field,
											e.currentTarget.checked,
										)
									}
								/>
							</Menu.Item>
						))}
						{columnOptions.custom.length > 0 ? <Menu.Divider /> : null}
						{columnOptions.custom.map((option) => (
							<Menu.Item key={option.field} component='div'>
								<Checkbox
									label={option.headerName}
									checked={columnOptions.visibleColumns.includes(option.field)}
									onChange={(e) =>
										columnOptions.onToggleColumn(
											option.field,
											e.currentTarget.checked,
										)
									}
								/>
							</Menu.Item>
						))}
					</>
				) : null}
			</Menu.Dropdown>
		</Menu>
	);
}
