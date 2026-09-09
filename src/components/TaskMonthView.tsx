import { useMemo, type CSSProperties, type ReactNode } from 'react';
import { ActionIcon, Box, Group } from '@mantine/core';
import { ChevronLeft, ChevronRight, ChevronsUpDown } from 'lucide-react';
import type { Task } from '../types/task';
import { bucketTasksByDay, dayMetrics } from '../taskCalendar/bucketTasks';
import {
	addMonths,
	calendarYearOptions,
	localDayKey,
	MONTH_LONG,
	MONTH_SHORT,
	monthGridDays,
	parseDayKey,
	WEEKDAY_SHORT,
	withMonth,
	withYear,
} from '../taskCalendar/dayKeys';
import { heatmapLevel, heatmapMinMax } from '../taskCalendar/heatmap';

type TaskMonthViewProps = {
	tasks: Task[];
	focusDayKey: string;
	compact?: boolean;
	onFocusDayKeyChange: (key: string) => void;
	onDayClick: (dayKey: string) => void;
};

function CalendarNavSelect({
	label,
	value,
	onChange,
	children,
}: {
	label: string;
	value: number;
	onChange: (value: number) => void;
	children: ReactNode;
}) {
	return (
		<label className='task-calendar-nav-field'>
			<select
				className='task-calendar-nav-label task-calendar-nav-select'
				aria-label={label}
				value={value}
				onChange={(e) => onChange(Number(e.target.value))}
			>
				{children}
			</select>
			<ChevronsUpDown
				className='task-calendar-nav-select-chevrons'
				size={12}
				strokeWidth={2.25}
				aria-hidden
			/>
		</label>
	);
}

export function TaskMonthView({
	tasks,
	focusDayKey,
	compact = false,
	onFocusDayKeyChange,
	onDayClick,
}: TaskMonthViewProps) {
	const todayKey = localDayKey(new Date());
	const gridDays = useMemo(() => monthGridDays(focusDayKey), [focusDayKey]);
	const byDay = useMemo(() => bucketTasksByDay(tasks), [tasks]);

	const cellData = useMemo(() => {
		return gridDays.map((cell) => {
			const dayTasks = byDay.get(cell.key) ?? [];
			const metrics = dayMetrics(dayTasks);
			return { ...cell, metrics };
		});
	}, [gridDays, byDay]);

	const { min, max } = useMemo(
		() =>
			heatmapMinMax(
				cellData.map((c) => c.metrics.total),
				cellData.map((c) => c.inMonth),
			),
		[cellData],
	);

	const prevMonth = () => onFocusDayKeyChange(addMonths(focusDayKey, -1));
	const nextMonth = () => onFocusDayKeyChange(addMonths(focusDayKey, 1));
	const focusDate = parseDayKey(focusDayKey);
	const focusMonth = focusDate.getMonth();
	const focusYear = focusDate.getFullYear();
	const years = useMemo(() => calendarYearOptions(new Date(), focusYear), [focusYear]);

	return (
		<Box className='task-month-view'>
			<Group className='task-calendar-nav' justify='center' gap='sm' mb='md' wrap='nowrap'>
				<ActionIcon
					variant='subtle'
					color='brand'
					aria-label='Previous month'
					onClick={prevMonth}
				>
					<ChevronLeft size={20} />
				</ActionIcon>
				<div className='task-calendar-nav-fields'>
					<CalendarNavSelect
						label='Month'
						value={focusMonth}
						onChange={(month) => onFocusDayKeyChange(withMonth(focusDayKey, month))}
					>
						{MONTH_LONG.map((monthLabel, monthIndex) => (
							<option key={monthLabel} value={monthIndex}>
								{compact ? MONTH_SHORT[monthIndex] : monthLabel}
							</option>
						))}
					</CalendarNavSelect>
					<span className='task-calendar-nav-fields-divider' aria-hidden />
					<CalendarNavSelect
						label='Year'
						value={focusYear}
						onChange={(year) => onFocusDayKeyChange(withYear(focusDayKey, year))}
					>
						{years.map((year) => (
							<option key={year} value={year}>
								{year}
							</option>
						))}
					</CalendarNavSelect>
				</div>
				<ActionIcon
					variant='subtle'
					color='brand'
					aria-label='Next month'
					onClick={nextMonth}
				>
					<ChevronRight size={20} />
				</ActionIcon>
			</Group>

			<div className='task-month-grid' role='grid' aria-label='Task calendar month'>
				<div className='task-month-grid-header' role='row'>
					{WEEKDAY_SHORT.map((label) => (
						<div key={label} className='task-month-grid-header-cell' role='columnheader'>
							{label}
						</div>
					))}
				</div>
				<div className='task-month-grid-body'>
					{cellData.map((cell) => {
						const heat =
							cell.inMonth && cell.metrics.total > 0
								? heatmapLevel(cell.metrics.total, min, max)
								: 0;
						const isToday = cell.key === todayKey;
						const dayNum = parseDayKey(cell.key).getDate();
						return (
							<button
								key={cell.key}
								type='button'
								className='task-month-cell'
								data-outside-month={!cell.inMonth || undefined}
								data-today={isToday || undefined}
								style={
									heat > 0
										? ({ '--task-heat': String(heat) } as CSSProperties)
										: undefined
								}
								aria-label={`${cell.key}, ${cell.metrics.total} tasks`}
								onClick={() => onDayClick(cell.key)}
							>
								<span className='task-month-cell-day'>{dayNum}</span>
								{cell.inMonth && cell.metrics.total > 0 ? (
									<span className='task-month-cell-metrics'>
										<span className='task-month-cell-count'>
											{cell.metrics.total}
										</span>
										{!compact && cell.metrics.inProgress > 0 ? (
											<span className='task-month-cell-in-progress'>
												{cell.metrics.inProgress} active
											</span>
										) : null}
									</span>
								) : null}
							</button>
						);
					})}
				</div>
			</div>
		</Box>
	);
}
