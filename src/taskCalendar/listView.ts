export type TaskListView = 'month' | 'week' | 'day';

export const TASK_LIST_VIEWS: TaskListView[] = ['month', 'week', 'day'];

export function isTaskListView(value: string): value is TaskListView {
	return value === 'month' || value === 'week' || value === 'day';
}
