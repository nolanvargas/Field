import { useMemo, useRef, useState, type MouseEvent } from 'react';
import { ActionIcon, Box, Group, Text } from '@mantine/core';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useOrgSettings } from '../context/OrgSettingsContext';
import { resolveOrgTaskIcon } from '../orgIcons';
import type { Task } from '../types/task';
import { TaskStatusBadge } from './TaskStatusBadge';
import { TaskWeekTaskHoverCard } from './TaskWeekTaskHoverCard';
import { TASK_WEEK_HOVER_CARD_OPEN_DELAY_MS } from './taskWeekHoverCard';
import {
	addDays,
	formatPickedDayLabel,
} from '../taskCalendar/dayKeys';
import {
	hourLabels,
	sortTasksForDayBoard,
	taskDayBoardSpan,
} from '../taskCalendar/dayBoard';

type TaskDayViewProps = {
	tasks: Task[];
	focusDayKey: string;
	onFocusDayKeyChange: (key: string) => void;
	onTaskClick: (taskId: number) => void;
};

type TaskHoverState = {
	task: Task;
	x: number;
	y: number;
};

export function TaskDayView({
	tasks,
	focusDayKey,
	onFocusDayKeyChange,
	onTaskClick,
}: TaskDayViewProps) {
	const { settings } = useOrgSettings();
	const hours = useMemo(() => hourLabels(), []);
	const sortedTasks = useMemo(() => sortTasksForDayBoard(tasks), [tasks]);
	const iconByTypeName = useMemo(() => {
		const map = new Map<string, string>();
		for (const taskType of settings.taskTypes) {
			map.set(taskType.name, taskType.icon);
		}
		return map;
	}, [settings.taskTypes]);

	const [taskHover, setTaskHover] = useState<TaskHoverState | null>(null);
	const openTimerRef = useRef<number | null>(null);
	const pendingTaskRef = useRef<Task | null>(null);
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

	const scheduleTaskHover = (task: Task, x: number, y: number) => {
		clearOpenTimer();
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

	const prevDay = () => onFocusDayKeyChange(addDays(focusDayKey, -1));
	const nextDay = () => onFocusDayKeyChange(addDays(focusDayKey, 1));

	const hoveredIcon =
		taskHover != null
			? resolveOrgTaskIcon(iconByTypeName.get(taskHover.task.taskType))
			: null;

	return (
		<Box className='task-day-view'>
			<Group className='task-calendar-nav' justify='center' gap='xs' mb='sm'>
				<ActionIcon
					variant='subtle'
					color='brand'
					aria-label='Previous day'
					onClick={prevDay}
				>
					<ChevronLeft size={20} />
				</ActionIcon>
				<Text fw={600} className='task-calendar-nav-label'>
					{formatPickedDayLabel(focusDayKey)}
				</Text>
				<ActionIcon
					variant='subtle'
					color='brand'
					aria-label='Next day'
					onClick={nextDay}
				>
					<ChevronRight size={20} />
				</ActionIcon>
			</Group>

			<div className='task-day-board' role='table' aria-label='Task day schedule'>
				<div className='task-day-board-scroll'>
					<div className='task-day-board-inner'>
						<div className='task-day-board-header' role='row'>
							{hours.map((label, hour) => (
								<div
									key={hour}
									className='task-day-board-hour'
									role='columnheader'
									aria-label={label}
								>
									{label}
								</div>
							))}
						</div>
						<div className='task-day-board-body'>
							{sortedTasks.length === 0 ? (
								<p className='task-day-board-empty'>
									No tasks scheduled for this day.
								</p>
							) : (
								sortedTasks.map((task) => {
									const span = taskDayBoardSpan(task, focusDayKey);
									if (!span) return null;

									const Icon = resolveOrgTaskIcon(
										iconByTypeName.get(task.taskType),
									);
									const isHovered = taskHover?.task.id === task.id;

									return (
										<div
											key={task.id}
											className='task-day-board-row'
											role='row'
										>
											<button
												type='button'
												className='task-day-board-task'
												role='cell'
												data-hover-card={isHovered || undefined}
												style={{
													gridColumn: `${span.startCol} / ${span.endCol + 1}`,
												}}
												onClick={() => onTaskClick(task.id)}
												onMouseEnter={(event) =>
													handleTaskMouseEnter(task, event)
												}
												onMouseMove={(event) =>
													handleTaskMouseMove(task, event)
												}
												onMouseLeave={handleTaskMouseLeave}
											>
												<Icon
													className='task-day-board-task-icon'
													size={14}
													strokeWidth={2}
													aria-hidden
												/>
												<span className='task-day-board-task-key'>
													{task.externalKey}
												</span>
												<span className='task-day-board-task-title'>
													{task.jobTitle}
												</span>
												<span className='task-day-board-task-badge'>
													<TaskStatusBadge
														status={task.status}
														className='task-day-board-task-badge-label'
													/>
													<TaskStatusBadge
														status={task.status}
														variant='dot'
														className='task-day-board-task-badge-dot'
													/>
												</span>
											</button>
										</div>
									);
								})
							)}
						</div>
					</div>
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
		</Box>
	);
}
