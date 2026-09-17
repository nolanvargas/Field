import type { LucideIcon } from 'lucide-react';
import { formatShortNameList } from '../formatName';
import type { Task } from '../types/task';
import { RelativeTime } from './RelativeTime';
import { TaskStatusBadge } from './TaskStatusBadge';

export type TaskWeekTooltipRow = {
	label: string;
	value: string;
};

/** Structured tooltip rows for week-view task chips (testable). */
export function taskWeekTooltipRows(task: Task): TaskWeekTooltipRow[] {
	const rows: TaskWeekTooltipRow[] = [];

	const destination = task.destinationAddressName?.trim();
	if (destination) {
		rows.push({ label: 'Location', value: destination });
	}

	if (task.windowStartAt || task.windowEndAt) {
		rows.push({ label: 'Window', value: '' });
	}

	const crew = task.crewName?.trim();
	if (crew) {
		rows.push({ label: 'Crew', value: formatShortNameList(crew) });
	}

	return rows;
}

function TaskWeekTooltipWindow({
	start,
	end,
}: {
	start: string | null;
	end: string | null;
}) {
	return (
		<span className='task-week-board-task-tooltip-window'>
			<RelativeTime value={start} variant='shortWithAgo' />
			{' – '}
			<RelativeTime value={end} variant='shortWithAgo' />
		</span>
	);
}

export function TaskWeekTaskTooltipContent({
	task,
	TypeIcon,
}: {
	task: Task;
	TypeIcon: LucideIcon;
}) {
	const rows = taskWeekTooltipRows(task);

	return (
		<div className='task-week-board-task-tooltip-panel'>
			<header className='task-week-board-task-tooltip-header'>
				<div className='task-week-board-task-tooltip-type-row'>
					<TypeIcon
						className='task-week-board-task-tooltip-icon'
						size={18}
						strokeWidth={2}
						aria-hidden
					/>
					<span className='task-week-board-task-tooltip-type'>
						{task.taskType}
					</span>
				</div>
				<TaskStatusBadge status={task.status} />
			</header>

			{rows.length > 0 ? (
				<div className='task-week-board-task-tooltip-meta'>
					{rows.map((row) => (
						<div key={row.label} className='task-card-row'>
							<span className='task-card-row-label'>{row.label}</span>
							<span className='task-card-row-value'>
								{row.label === 'Window' ? (
									<TaskWeekTooltipWindow
										start={task.windowStartAt}
										end={task.windowEndAt}
									/>
								) : (
									row.value
								)}
							</span>
						</div>
					))}
				</div>
			) : null}
		</div>
	);
}
