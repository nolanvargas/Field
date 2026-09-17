import { filterDemoTasksForList, findDemoTaskRecord } from '../fixtures/tasks';
import { getDemoStore } from '../store';
import { errorResponse, jsonResponse } from '../response';

export function handleGetTasks(searchParams: URLSearchParams): Response {
	const { taskRecords } = getDemoStore();
	const tasks = filterDemoTasksForList(taskRecords, searchParams);
	return jsonResponse({ tasks });
}

export function handleGetTaskById(taskId: number): Response {
	const { taskRecords } = getDemoStore();
	const record = findDemoTaskRecord(taskRecords, taskId);
	if (!record) {
		return errorResponse('Task not found', 404);
	}
	return jsonResponse({
		task: {
			...record.detail,
			attachments: record.detail.attachments ?? [],
		},
	});
}
