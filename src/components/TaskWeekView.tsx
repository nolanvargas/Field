import { useMemo } from 'react';
import { ActionIcon, Box, Group, Text } from '@mantine/core';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Task } from '../types/task';
import { bucketTasksByDay } from '../taskCalendar/bucketTasks';
import {
	addDays,
	formatWeekLabel,
	parseDayKey,
	startOfWeek,
	WEEKDAY_SHORT,
	weekDayKeys,
} from '../taskCalendar/dayKeys';

type TaskWeekViewProps = {
	tasks: Task[];
	focusDayKey: string;
	onFocusDayKeyChange: (key: string) => void;
	onDayHeaderClick: (dayKey: string) => void;
	onTaskClick: (taskId: number) => void;
};

export function TaskWeekView({
	tasks,
	focusDayKey,
	onFocusDayKeyChange,
	onDayHeaderClick,
	onTaskClick,
}: TaskWeekViewProps) {
	const weekStart = useMemo(() => startOfWeek(focusDayKey), [focusDayKey]);
	const dayKeys = useMemo(() => weekDayKeys(weekStart), [weekStart]);
	const byDay = useMemo(() => bucketTasksByDay(tasks), [tasks]);

	const prevWeek = () => onFocusDayKeyChange(addDays(focusDayKey, -7));
	const nextWeek = () => onFocusDayKeyChange(addDays(focusDayKey, 7));

	return (
		<Box className='task-week-view'>
			<Group className='task-calendar-nav' justify='center' gap='xs' mb='sm'>
				<ActionIcon
					variant='subtle'
					color='brand'
					aria-label='Previous week'
					onClick={prevWeek}
				>
					<ChevronLeft size={20} />
				</ActionIcon>
				<Text fw={600} className='task-calendar-nav-label'>
					{formatWeekLabel(weekStart)}
				</Text>
				<ActionIcon
					variant='subtle'
					color='brand'
					aria-label='Next week'
					onClick={nextWeek}
				>
					<ChevronRight size={20} />
				</ActionIcon>
			</Group>

			<div className='task-week-board' role='table' aria-label='Task week board'>
				<div className='task-week-board-header' role='row'>
					{dayKeys.map((key) => {
						const d = parseDayKey(key);
						return (
							<button
								key={key}
								type='button'
								className='task-week-board-header-cell'
								role='columnheader'
								aria-label={`View day ${key}`}
								onClick={() => onDayHeaderClick(key)}
							>
								<span className='task-week-board-weekday'>
									{WEEKDAY_SHORT[d.getDay()]}
								</span>
								<span className='task-week-board-date'>{d.getDate()}</span>
							</button>
						);
					})}
				</div>
				<div className='task-week-board-body'>
					{dayKeys.map((key) => {
						const dayTasks = byDay.get(key) ?? [];
						return (
							<div key={key} className='task-week-board-col' role='cell'>
								{dayTasks.length === 0 ? (
									<p className='task-week-board-empty'>—</p>
								) : (
									<ul className='task-week-board-list'>
										{dayTasks.map((task) => (
											<li key={task.id}>
												<button
													type='button'
													className='task-week-board-task'
													onClick={() => onTaskClick(task.id)}
												>
													<span className='task-week-board-task-key'>
														{task.externalKey}
													</span>
													{task.jobTitle ? (
														<span className='task-week-board-task-title'>
															{task.jobTitle}
														</span>
													) : null}
												</button>
											</li>
										))}
									</ul>
								)}
							</div>
						);
					})}
				</div>
			</div>
		</Box>
	);
}
