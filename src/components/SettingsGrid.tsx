import type { CSSProperties, ReactNode } from 'react';
import { ActionIcon, Text } from '@mantine/core';
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react';

export type SettingsGridColumn = {
	key: string;
	/** Shown once in the header row, and again per cell when rows stack on mobile. */
	header: string;
	/** CSS grid track for this column. Defaults to a capped field width, not 1fr. */
	width?: string;
	align?: 'center';
};

export type SettingsGridRow = {
	key: string;
	/** Keyed by column key. A missing or `null` cell renders as blank. */
	cells: Record<string, ReactNode>;
	/** Names the row in the reorder/remove action labels. */
	label: string;
	/** Fixed-slot grids leave the remove action disabled until the row holds data. */
	removable?: boolean;
};

type SettingsGridProps = {
	/** Accessible name for the grid as a whole. */
	label: string;
	columns: SettingsGridColumn[];
	rows: SettingsGridRow[];
	/** Omit to hide the reorder controls. */
	onMove?: (index: number, direction: -1 | 1) => void;
	/** Omit to hide the remove control. */
	onRemove?: (index: number) => void;
	removeLabel?: string;
	emptyMessage?: string;
	/** Size of reorder/remove action buttons. Defaults to `sm`. */
	actionIconSize?: 'sm' | 'md' | 'lg';
};

const ACTION_ICON_STROKE: Record<'sm' | 'md' | 'lg', number> = {
	sm: 14,
	md: 18,
	lg: 20,
};

export function SettingsGrid({
	label,
	columns,
	rows,
	onMove,
	onRemove,
	removeLabel = 'Remove',
	emptyMessage = 'Nothing configured yet.',
	actionIconSize = 'sm',
}: SettingsGridProps) {
	if (rows.length === 0) {
		return (
			<Text size='sm' c='dimmed'>
				{emptyMessage}
			</Text>
		);
	}

	const hasActions = Boolean(onMove || onRemove);
	const tracks = columns.map(
		(column) => column.width ?? 'minmax(10rem, 18rem)',
	);
	if (hasActions) tracks.push('max-content');

	const iconStroke = ACTION_ICON_STROKE[actionIconSize];

	return (
		<div
			className='field-settings-grid'
			role='group'
			aria-label={label}
			style={{ '--settings-grid-cols': tracks.join(' ') } as CSSProperties}
		>
			<div className='field-settings-grid-head' aria-hidden='true'>
				{columns.map((column) => (
					<div
						key={column.key}
						className='field-settings-grid-header'
						data-align={column.align}
					>
						{column.header}
					</div>
				))}
				{hasActions ? <div className='field-settings-grid-header' /> : null}
			</div>
			<div className='field-settings-grid-rule' aria-hidden='true' />

			{rows.map((row, index) => (
				<div key={row.key} className='field-settings-grid-row'>
					{columns.map((column) => {
						const cell = row.cells[column.key];
						/* Blank cells hold the column open on desktop, collapse when stacked. */
						return (
							<div
								key={column.key}
								className='field-settings-grid-cell'
								data-align={column.align}
								data-empty={cell == null || undefined}
							>
								{cell == null ? null : (
									<span className='field-settings-grid-cell-label' aria-hidden='true'>
										{column.header}
									</span>
								)}
								{cell}
							</div>
						);
					})}

					{hasActions ? (
						<div className='field-settings-grid-cell field-settings-grid-actions'>
							{onMove ? (
								<>
									<ActionIcon
										variant='subtle'
										color='gray'
										size={actionIconSize}
										aria-label={`Move ${row.label} up`}
										disabled={index === 0}
										onClick={() => onMove(index, -1)}
									>
										<ChevronUp size={iconStroke} />
									</ActionIcon>
									<ActionIcon
										variant='subtle'
										color='gray'
										size={actionIconSize}
										aria-label={`Move ${row.label} down`}
										disabled={index === rows.length - 1}
										onClick={() => onMove(index, 1)}
									>
										<ChevronDown size={iconStroke} />
									</ActionIcon>
								</>
							) : null}
							{onRemove ? (
								<ActionIcon
									variant='subtle'
									color='red'
									size={actionIconSize}
									aria-label={`${removeLabel} ${row.label}`}
									title={removeLabel}
									disabled={row.removable === false}
									onClick={() => onRemove(index)}
								>
									<Trash2 size={iconStroke} />
								</ActionIcon>
							) : null}
						</div>
					) : null}
				</div>
			))}
		</div>
	);
}
