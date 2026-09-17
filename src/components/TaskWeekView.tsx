import { useMemo, useRef, useState, type MouseEvent } from 'react';
import { ActionIcon, Box, Group, Text } from '@mantine/core';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useOrgSettings } from '../context/OrgSettingsContext';
import { resolveOrgTaskIcon } from '../orgIcons';
import type { Task } from '../types/task';
import { TaskStatusBadge } from './TaskStatusBadge';
import { TaskWeekDayHoverCard } from './TaskWeekDayHoverCard';
import { buildTaskWeekDayTooltipData } from './taskWeekDayTooltip';
import { TaskWeekTaskHoverCard } from './TaskWeekTaskHoverCard';
import { TASK_WEEK_HOVER_CARD_OPEN_DELAY_MS } from './taskWeekHoverCard';
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

type TaskHoverState = {
	task: Task;
	x: number;
	y: number;
};

type DayHoverState = {
	dayKey: string;
	x: number;
	y: number;
};

export function TaskWeekView({
	tasks,
	focusDayKey,
	onFocusDayKeyChange,
	onDayHeaderClick,
	onTaskClick,
}: TaskWeekViewProps) {
	const { settings } = useOrgSettings();
	const weekStart = useMemo(() => startOfWeek(focusDayKey), [focusDayKey]);
	const dayKeys = useMemo(() => weekDayKeys(weekStart), [weekStart]);
	const byDay = useMemo(() => bucketTasksByDay(tasks), [tasks]);
	const typeOrder = useMemo(
		() => settings.taskTypes.map((taskType) => taskType.name),
		[settings.taskTypes],
	);
	const iconByTypeName = useMemo(() => {
		const map = new Map<string, string>();
		for (const taskType of settings.taskTypes) {
			map.set(taskType.name, taskType.icon);
		}
		return map;
	}, [settings.taskTypes]);

	const [taskHover, setTaskHover] = useState<TaskHoverState | null>(null);
	const [dayHover, setDayHover] = useState<DayHoverState | null>(null);
	const openTimerRef = useRef<number | null>(null);
	const pendingTaskRef = useRef<Task | null>(null);
	const pendingDayRef = useRef<string | null>(null);
	const pendingPosRef = useRef({ x: 0, y: 0 });

	const clearOpenTimer = () => {
		if (openTimerRef.current != null) {
			window.clearTimeout(openTimerRef.current);
			openTimerRef.current = null;
		}
	};

	const clearTaskHover = () => {
		pendingTaskRef.current = null;
		setTaskHover(null);
	};

	const clearDayHover = () => {
		pendingDayRef.current = null;
		setDayHover(null);
	};

	const scheduleTaskHover = (task: Task, x: number, y: number) => {
		clearOpenTimer();
		clearDayHover();
		pendingTaskRef.current = task;
		pendingPosRef.current = { x, y };
		openTimerRef.current = window.setTimeout(() => {
			openTimerRef.current = null;
			if (pendingTaskRef.current?.id === task.id) {
				setTaskHover({
					task,
					x: pendingPosRef.current.x,
					y: pendingPosRef.current.y,
				});
			}
		}, TASK_WEEK_HOVER_CARD_OPEN_DELAY_MS);
	};

	const scheduleDayHover = (dayKey: string, x: number, y: number) => {
		clearOpenTimer();
		clearTaskHover();
		pendingDayRef.current = dayKey;
		pendingPosRef.current = { x, y };
		openTimerRef.current = window.setTimeout(() => {
			openTimerRef.current = null;
			if (pendingDayRef.current === dayKey) {
				setDayHover({
					dayKey,
					x: pendingPosRef.current.x,
					y: pendingPosRef.current.y,
				});
			}
		}, TASK_WEEK_HOVER_CARD_OPEN_DELAY_MS);
	};

	const handleTaskMouseEnter = (task: Task, event: MouseEvent) => {
		scheduleTaskHover(task, event.clientX, event.clientY);
	};

	const handleTaskMouseMove = (task: Task, event: MouseEvent) => {
		if (taskHover?.task.id === task.id) {
			setTaskHover({ task, x: event.clientX, y: event.clientY });
			return;
		}
		if (pendingTaskRef.current?.id === task.id) {
			pendingPosRef.current = { x: event.clientX, y: event.clientY };
		}
	};

	const handleTaskMouseLeave = () => {
		clearOpenTimer();
		clearTaskHover();
	};

	const handleDayHeaderMouseEnter = (dayKey: string, event: MouseEvent) => {
		scheduleDayHover(dayKey, event.clientX, event.clientY);
	};

	const handleDayHeaderMouseMove = (dayKey: string, event: MouseEvent) => {
		if (dayHover?.dayKey === dayKey) {
			setDayHover({ dayKey, x: event.clientX, y: event.clientY });
			return;
		}
		if (pendingDayRef.current === dayKey) {
			pendingPosRef.current = { x: event.clientX, y: event.clientY };
		}
	};

	const handleDayHeaderMouseLeave = () => {
		clearOpenTimer();
		clearDayHover();
	};

	const prevWeek = () => onFocusDayKeyChange(addDays(focusDayKey, -7));
	const nextWeek = () => onFocusDayKeyChange(addDays(focusDayKey, 7));

	const hoveredIcon =
		taskHover != null
			? resolveOrgTaskIcon(iconByTypeName.get(taskHover.task.taskType))
			: null;

	const dayHoverData =
		dayHover != null
			? buildTaskWeekDayTooltipData(
					dayHover.dayKey,
					byDay.get(dayHover.dayKey) ?? [],
					typeOrder,
				)
			: null;

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
						const isDayHovered = dayHover?.dayKey === key;
						return (
							<button
								key={key}
								type='button'
								className='task-week-board-header-cell'
								role='columnheader'
								aria-label={`View day ${key}`}
								data-hover-card={isDayHovered || undefined}
								onClick={() => onDayHeaderClick(key)}
								onMouseEnter={(event) => handleDayHeaderMouseEnter(key, event)}
								onMouseMove={(event) => handleDayHeaderMouseMove(key, event)}
								onMouseLeave={handleDayHeaderMouseLeave}
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
										{dayTasks.map((task) => {
											const Icon = resolveOrgTaskIcon(
												iconByTypeName.get(task.taskType),
											);
											const isHovered = taskHover?.task.id === task.id;
											return (
												<li key={task.id}>
													<button
														type='button'
														className='task-week-board-task'
														data-hover-card={isHovered || undefined}
														onClick={() => onTaskClick(task.id)}
														onMouseEnter={(event) =>
															handleTaskMouseEnter(task, event)
														}
														onMouseMove={(event) =>
															handleTaskMouseMove(task, event)
														}
														onMouseLeave={handleTaskMouseLeave}
													>
														<span className='task-week-board-task-top'>
															<span className='task-week-board-task-identity'>
																<Icon
																	className='task-week-board-task-icon'
																	size={14}
																	strokeWidth={2}
																	aria-hidden
																/>
																<span className='task-week-board-task-key'>
																	{task.externalKey}
																</span>
															</span>
															<TaskStatusBadge status={task.status} />
														</span>
														{task.jobTitle ? (
															<span className='task-week-board-task-title'>
																{task.jobTitle}
															</span>
														) : null}
													</button>
												</li>
											);
										})}
									</ul>
								)}
							</div>
						);
					})}
				</div>
			</div>

			{taskHover != null && hoveredIcon != null ? (
				<TaskWeekTaskHoverCard
					task={taskHover.task}
					TypeIcon={hoveredIcon}
					x={taskHover.x}
					y={taskHover.y}
				/>
			) : null}

			{dayHover != null && dayHoverData != null ? (
				<TaskWeekDayHoverCard
					dayLabel={dayHoverData.dayLabel}
					total={dayHoverData.total}
					typeCounts={dayHoverData.typeCounts}
					statusCounts={dayHoverData.statusCounts}
					iconByTypeName={iconByTypeName}
					x={dayHover.x}
					y={dayHover.y}
				/>
			) : null}
		</Box>
	);
}
