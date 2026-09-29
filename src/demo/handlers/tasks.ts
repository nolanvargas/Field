import { filterDemoTasksForList, findDemoTaskRecord } from '../fixtures/tasks';
import { getDemoStore } from '../store';
import { errorResponse, jsonResponse } from '../response';

export function handleGetTasks(searchParams: URLSearchParams): Response {
	const { taskRecords } = getDemoStore();
	const tasks = filterDemoTasksForList(taskRecords, searchParams);
	return jsonResponse({ tasks });
}

export function handleLookupTasks(query: string): Response {
	const q = query.trim();
	if (!q) return errorResponse('Query is required', 400);
	const { taskRecords } = getDemoStore();
	const tasks = taskRecords
		.filter((record) => record.detail.externalKey === q)
		.map((record) => ({
			id: record.detail.id,
			externalKey: record.detail.externalKey,
			jobTitle: record.detail.jobTitle ?? '',
			taskType: record.detail.taskType,
			createdAt: record.detail.createdAt,
		}))
		.sort((a, b) => {
			const at = new Date(a.createdAt).getTime();
			const bt = new Date(b.createdAt).getTime();
			return bt - at || b.id - a.id;
		});
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
