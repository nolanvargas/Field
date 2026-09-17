import {
	demoFixturePublicUrl,
	findDemoAttachment,
} from '../fixtures/attachmentMedia';
import { findDemoTaskRecord } from '../fixtures/tasks';
import { getDemoStore } from '../store';
import { errorResponse, jsonResponse } from '../response';

export function handleListAttachments(taskId: number): Response {
	const { taskRecords } = getDemoStore();
	const record = findDemoTaskRecord(taskRecords, taskId);
	if (!record) {
		return errorResponse('Task not found', 404);
	}
	return jsonResponse({ attachments: record.detail.attachments ?? [] });
}

export function handleAttachmentDownloadUrl(
	taskId: number,
	attachmentId: number,
	inline: boolean,
): Response {
	const { taskRecords } = getDemoStore();
	const record = findDemoTaskRecord(taskRecords, taskId);
	if (!record) {
		return errorResponse('Task not found', 404);
	}
	const attachment = findDemoAttachment(
		taskId,
		attachmentId,
		record.detail.attachments ?? [],
	);
	if (!attachment) {
		return errorResponse('Attachment not found', 404);
	}
	const downloadUrl = demoFixturePublicUrl(attachment.storageKey);
	return jsonResponse({
		downloadUrl,
		inline: inline ? true : undefined,
	});
}
