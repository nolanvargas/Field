import type { AttachmentKind, TaskAttachment } from '../../types/task';
import {
	curatedAttachmentByteSize,
	curatedAttachmentFileName,
	pickCuratedDemoAttachmentStorageKey,
} from '../../../shared/curatedAttachmentPool.mjs';
import { DEMO_CREW_USER_ID } from './boot';

/** Stable org attachment type ids (match boot org settings). */
export const DEMO_ATTACHMENT_TYPE_COMPLETION_PHOTOS_ID = 1;
export const DEMO_ATTACHMENT_TYPE_METER_ID = 2;

export function pickDemoStorageKey(poolKind: string, seed: number): string {
	return pickCuratedDemoAttachmentStorageKey(poolKind, seed);
}

/** Public URL for Vite static assets under `public/`. */
export function demoFixturePublicUrl(storageKey: string): string {
	const normalized = storageKey.replace(/^\/+/, '');
	return `/${normalized}`;
}

type AttachmentTemplate = {
	kind: AttachmentKind;
	poolKind: string;
	mimeType: string;
	fileName: string;
	caption?: string;
	attachmentTypeId: number | null;
	attachmentTypeSlug: string | null;
	attachmentTypeLabel: string | null;
};

const ATTACHMENT_TEMPLATES: AttachmentTemplate[] = [
	{
		kind: 'photo',
		poolKind: 'photo',
		mimeType: 'image/jpeg',
		fileName: 'site-photo.jpg',
		caption: 'Site condition',
		attachmentTypeId: DEMO_ATTACHMENT_TYPE_COMPLETION_PHOTOS_ID,
		attachmentTypeSlug: 'completion_photos',
		attachmentTypeLabel: 'Completion photos',
	},
	{
		kind: 'photo',
		poolKind: 'photo',
		mimeType: 'image/jpeg',
		fileName: 'proof-photo.jpg',
		caption: 'Proof of work',
		attachmentTypeId: DEMO_ATTACHMENT_TYPE_COMPLETION_PHOTOS_ID,
		attachmentTypeSlug: 'completion_photos',
		attachmentTypeLabel: 'Completion photos',
	},
	{
		kind: 'document',
		poolKind: 'document',
		mimeType: 'application/pdf',
		fileName: 'field-notes.pdf',
		attachmentTypeId: DEMO_ATTACHMENT_TYPE_COMPLETION_PHOTOS_ID,
		attachmentTypeSlug: 'completion_photos',
		attachmentTypeLabel: 'Completion photos',
	},
	{
		kind: 'signature',
		poolKind: 'signature',
		mimeType: 'image/gif',
		fileName: 'signoff.gif',
		caption: 'Customer sign-off',
		attachmentTypeId: DEMO_ATTACHMENT_TYPE_COMPLETION_PHOTOS_ID,
		attachmentTypeSlug: 'completion_photos',
		attachmentTypeLabel: 'Completion photos',
	},
	{
		kind: 'video',
		poolKind: 'video',
		mimeType: 'video/mp4',
		fileName: 'walkthrough.mp4',
		attachmentTypeId: DEMO_ATTACHMENT_TYPE_COMPLETION_PHOTOS_ID,
		attachmentTypeSlug: 'completion_photos',
		attachmentTypeLabel: 'Completion photos',
	},
	{
		kind: 'photo',
		poolKind: 'photo',
		mimeType: 'image/jpeg',
		fileName: 'meter-reading.jpg',
		caption: 'Meter panel',
		attachmentTypeId: DEMO_ATTACHMENT_TYPE_METER_ID,
		attachmentTypeSlug: 'meter',
		attachmentTypeLabel: 'Meter',
	},
];

function minAttachmentsForTask(
	status: string,
	taskType: string,
	taskId: number,
): number {
	if (status === 'Unassigned') return 0;
	if (status === 'Assigned') {
		if (taskType === 'Delivery' || taskType === 'Install') return 1;
		return taskId % 2 === 0 ? 1 : 0;
	}
	if (status === 'In Progress') return 1;
	if (status === 'Failed' || status === 'Undetermined') return 1;
	if (taskType === 'Site Survey') return 2;
	if (taskType === 'Delivery' || taskType === 'Install') return 2;
	return 1;
}

export function buildDemoAttachments(opts: {
	taskId: number;
	status: string;
	taskType: string;
	baseAt: string;
	uploaderId: string;
	secondUploaderId: string;
}): TaskAttachment[] {
	const target = minAttachmentsForTask(opts.status, opts.taskType, opts.taskId);
	if (target === 0) return [];

	const out: TaskAttachment[] = [];
	let i = 0;
	while (out.length < target && i < ATTACHMENT_TEMPLATES.length) {
		const tpl =
			opts.taskType === 'Site Survey' && out.length === 0
				? ATTACHMENT_TEMPLATES[5]
				: ATTACHMENT_TEMPLATES[i];
		const storageKey = pickDemoStorageKey(tpl.poolKind, opts.taskId + i);
		const curatedName = curatedAttachmentFileName(storageKey);
		const attachmentId = opts.taskId * 100 + out.length + 1;
		const uploader =
			i % 2 === 0 ? opts.uploaderId : opts.secondUploaderId;
		const uploaderName =
			uploader === DEMO_CREW_USER_ID ? 'Demo Crew' : 'Demo Dispatch';
		const createdAt = new Date(
			new Date(opts.baseAt).getTime() - (20 - i * 5) * 60 * 1000,
		).toISOString();

		out.push({
			id: attachmentId,
			taskId: opts.taskId,
			kind: tpl.kind,
			storageKey,
			mimeType: tpl.mimeType,
			fileName: curatedName ?? tpl.fileName,
			fileSizeBytes: curatedAttachmentByteSize(storageKey) ?? 100,
			caption: tpl.caption ?? null,
			createdAt,
			uploadedByUserId: uploader,
			uploadedByName: uploaderName,
			attachmentTypeId: tpl.attachmentTypeId,
			attachmentTypeSlug: tpl.attachmentTypeSlug,
			attachmentTypeLabel: tpl.attachmentTypeLabel,
		});
		i += 1;
	}
	return out;
}

export function findDemoAttachment(
	taskId: number,
	attachmentId: number,
	attachments: TaskAttachment[],
): TaskAttachment | undefined {
	return attachments.find(
		(a) => a.taskId === taskId && a.id === attachmentId,
	);
}
