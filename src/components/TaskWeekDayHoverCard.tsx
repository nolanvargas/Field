import { createPortal } from 'react-dom';
import type { DayStatusCount, DayTypeCount } from '../taskCalendar/bucketTasks';
import {
	clampTaskWeekHoverCardPosition,
	TASK_WEEK_DAY_HOVER_CARD_HEIGHT,
	TASK_WEEK_DAY_HOVER_CARD_WIDTH,
} from './taskWeekHoverCard';
import { TaskWeekDayTooltipContent } from './TaskWeekDayTooltipContent';

type TaskWeekDayHoverCardProps = {
	dayLabel: string;
	total: number;
	typeCounts: DayTypeCount[];
	statusCounts: DayStatusCount[];
	iconByTypeName: ReadonlyMap<string, string>;
	x: number;
	y: number;
};

export function TaskWeekDayHoverCard({
	dayLabel,
	total,
	typeCounts,
	statusCounts,
	iconByTypeName,
	x,
	y,
}: TaskWeekDayHoverCardProps) {
	const { left, top } = clampTaskWeekHoverCardPosition(
		x,
		y,
		window.innerWidth,
		window.innerHeight,
		{
			width: TASK_WEEK_DAY_HOVER_CARD_WIDTH,
			height: TASK_WEEK_DAY_HOVER_CARD_HEIGHT,
		},
	);

	return createPortal(
		<div
			className='task-week-board-task-tooltip task-week-board-task-tooltip--day'
			role='tooltip'
			style={{ left, top }}
		>
			<TaskWeekDayTooltipContent
				dayLabel={dayLabel}
				total={total}
				typeCounts={typeCounts}
				statusCounts={statusCounts}
				iconByTypeName={iconByTypeName}
			/>
		</div>,
		document.body,
	);
}
