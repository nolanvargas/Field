import type { LucideIcon } from 'lucide-react';
import { createPortal } from 'react-dom';
import type { Task } from '../types/task';
import {
	clampTaskWeekHoverCardPosition,
	TASK_WEEK_HOVER_CARD_HEIGHT,
	TASK_WEEK_HOVER_CARD_WIDTH,
} from './taskWeekHoverCard';
import { TaskWeekTaskTooltipContent } from './TaskWeekTaskTooltip';

type TaskWeekTaskHoverCardProps = {
	task: Task;
	TypeIcon: LucideIcon;
	x: number;
	y: number;
};

export function TaskWeekTaskHoverCard({
	task,
	TypeIcon,
	x,
	y,
}: TaskWeekTaskHoverCardProps) {
	const { left, top } = clampTaskWeekHoverCardPosition(
		x,
		y,
		window.innerWidth,
		window.innerHeight,
	);

	return createPortal(
		<div
			className='task-week-board-task-tooltip task-week-board-task-tooltip--floating'
			role='tooltip'
			style={{ left, top }}
		>
			<TaskWeekTaskTooltipContent task={task} TypeIcon={TypeIcon} />
		</div>,
		document.body,
	);
}

export { TASK_WEEK_HOVER_CARD_HEIGHT, TASK_WEEK_HOVER_CARD_WIDTH };
