export type TaskListView = 'month' | 'week' | 'day' | 'list';

export const TASK_LIST_VIEWS: TaskListView[] = ['month', 'week', 'day', 'list'];

export function isTaskListView(value: string): value is TaskListView {
	return (
		value === 'month' ||
		value === 'week' ||
		value === 'day' ||
		value === 'list'
	);
}
