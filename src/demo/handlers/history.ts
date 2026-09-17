import { findDemoTaskRecord } from '../fixtures/tasks';
import { getDemoStore } from '../store';
import { errorResponse, jsonResponse } from '../response';

export function handleGetTaskHistory(taskId: number): Response {
	const { taskRecords } = getDemoStore();
	const record = findDemoTaskRecord(taskRecords, taskId);
	if (!record) {
		return errorResponse('Task not found', 404);
	}
	return jsonResponse({ events: record.history });
}
