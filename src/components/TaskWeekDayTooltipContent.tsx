import { resolveOrgTaskIcon } from '../orgIcons';
import type { DayStatusCount, DayTypeCount } from '../taskCalendar/bucketTasks';
import { TaskStatusBadge } from './TaskStatusBadge';
import { taskWeekDayTotalLabel } from './taskWeekDayTooltip';

type TaskWeekDayTooltipContentProps = {
	dayLabel: string;
	total: number;
	typeCounts: DayTypeCount[];
	statusCounts: DayStatusCount[];
	iconByTypeName: ReadonlyMap<string, string>;
};

function EmptyPane() {
	return <p className='task-week-day-tooltip-empty'>—</p>;
}

export function TaskWeekDayTooltipContent({
	dayLabel,
	total,
	typeCounts,
	statusCounts,
	iconByTypeName,
}: TaskWeekDayTooltipContentProps) {
	return (
		<div className='task-week-board-task-tooltip-panel task-week-day-tooltip-panel'>
			<header className='task-week-day-tooltip-header'>
				<span className='task-week-day-tooltip-date'>{dayLabel}</span>
				<span className='task-week-day-tooltip-leader' aria-hidden />
				<span className='task-week-day-tooltip-total'>
					{taskWeekDayTotalLabel(total)}
				</span>
			</header>

			<div className='task-week-day-tooltip-panes'>
				<section className='task-week-day-tooltip-pane' aria-label='Tasks by type'>
					<h3 className='task-week-day-tooltip-pane-title'>Type</h3>
					{typeCounts.length === 0 ? (
						<EmptyPane />
					) : (
						<ul className='task-week-day-tooltip-list'>
							{typeCounts.map(({ typeName, count }) => {
								const Icon = resolveOrgTaskIcon(iconByTypeName.get(typeName));
								return (
									<li key={typeName} className='task-week-day-tooltip-row'>
										<span className='task-week-day-tooltip-type-label'>
											<Icon
												className='task-week-day-tooltip-type-icon'
												size={16}
												strokeWidth={2}
												aria-hidden
											/>
											<span className='task-week-day-tooltip-type-name'>
												{typeName}
											</span>
										</span>
										<span className='task-week-day-tooltip-leader' aria-hidden />
										<span className='task-week-day-tooltip-count'>{count}</span>
									</li>
								);
							})}
						</ul>
					)}
				</section>

				<section
					className='task-week-day-tooltip-pane'
					aria-label='Tasks by status'
				>
					<h3 className='task-week-day-tooltip-pane-title'>Status</h3>
					{statusCounts.length === 0 ? (
						<EmptyPane />
					) : (
						<ul className='task-week-day-tooltip-list'>
							{statusCounts.map(({ status, count }) => (
								<li key={status} className='task-week-day-tooltip-row'>
									<span className='task-week-day-tooltip-status-label'>
										<TaskStatusBadge status={status} />
									</span>
									<span className='task-week-day-tooltip-leader' aria-hidden />
									<span className='task-week-day-tooltip-count'>{count}</span>
								</li>
							))}
						</ul>
					)}
				</section>
			</div>
		</div>
	);
}
