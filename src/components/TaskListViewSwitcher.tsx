import type { TaskListView } from '../taskCalendar/listView';

const VIEW_LABELS: Record<TaskListView, string> = {
	month: 'Month',
	week: 'Week',
	day: 'Day',
};

type TaskListViewSwitcherProps = {
	value: TaskListView;
	onChange: (view: TaskListView) => void;
	showWeek: boolean;
};

export function TaskListViewSwitcher({
	value,
	onChange,
	showWeek,
}: TaskListViewSwitcherProps) {
	const views: TaskListView[] = showWeek
		? ['month', 'week', 'day']
		: ['month', 'day'];

	return (
		<div
			className='tasks-list-view-switcher'
			role='group'
			aria-label='Task list view'
		>
			{views.map((view) => (
				<button
					key={view}
					type='button'
					className='tasks-list-view-switcher-segment'
					data-selected={value === view || undefined}
					aria-pressed={value === view}
					onClick={() => onChange(view)}
				>
					{VIEW_LABELS[view]}
				</button>
			))}
		</div>
	);
}
