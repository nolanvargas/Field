import { clientCompanyName } from './branding';
import type { TrackingPageImageAttachment } from './components/TrackingPageBlockRenderer';
import type {
	TrackingPageDocument,
	TrackingPageHistoryEvent,
} from './pages/TrackingPage';

/** Mirrors seed task #1 (Mandalay Bay delivery) for a believable editor preview. */
export function buildTrackingPagePreviewMergeTags(
	taskTypeName: string,
): Record<string, string> {
	const isDelivery = taskTypeName === 'Delivery';
	return {
		'task.job_title': isDelivery
			? '26-MBAY-12468-049 — WLV Stanchion Topper Signs x4'
			: '27-ARIA-5510 — Escalator wrap refresh',
		'task.status': 'Completed',
		'task.task_type': taskTypeName,
		'task.destination_name': isDelivery
			? 'Mandalay Bay — Sign Shop'
			: 'ARIA Resort — North escalator bank',
		'task.completed_at': 'Jul 26, 2026, 11:42 AM',
		'task.external_key': isDelivery ? '99252' : '99401',
		'task.contact_name': isDelivery ? 'Riley Hayes' : 'Uma Patel',
		'company.name': clientCompanyName(),
	};
}

export const TRACKING_PAGE_PREVIEW_DOCUMENTS: TrackingPageDocument[] = [
	{
		kind: 'delivery_docket',
		fileName: 'delivery-docket-1.pdf',
		available: true,
	},
	{
		kind: 'proof_of_completion',
		fileName: 'pod-1.pdf',
		available: true,
	},
];

export const TRACKING_PAGE_PREVIEW_HISTORY: TrackingPageHistoryEvent[] = [
	{
		id: 'preview-created',
		type: 'created',
		at: '2026-07-24T16:15:00.000Z',
		title: 'Order received',
		fromStatus: null,
		toStatus: null,
		detail: null,
	},
	{
		id: 'preview-in-progress',
		type: 'status_changed',
		at: '2026-07-26T16:05:00.000Z',
		title: 'Status Undetermined → In Progress',
		fromStatus: 'Undetermined',
		toStatus: 'In Progress',
		detail: null,
	},
	{
		id: 'preview-completed',
		type: 'status_changed',
		at: '2026-07-26T18:42:00.000Z',
		title: 'Status In Progress → Completed',
		fromStatus: 'In Progress',
		toStatus: 'Completed',
		detail: null,
	},
	{
		id: 'preview-docket',
		type: 'document_generated',
		at: '2026-07-26T18:43:00.000Z',
		title: 'Delivery docket generated',
		fromStatus: null,
		toStatus: null,
		detail: 'delivery_docket',
	},
];

export const TRACKING_PAGE_PREVIEW_IMAGE_ATTACHMENTS: TrackingPageImageAttachment[] =
	[
		{
			url: '/tracking-preview/delivery-stack.svg',
			alt: 'Stanchion toppers against sign-shop wall',
			fileName: 'delivery-stack.svg',
			mimeType: 'image/svg+xml',
		},
		{
			url: '/tracking-preview/unload-photo.svg',
			alt: 'Unload at Mandalay Bay loading dock',
			fileName: 'unload-photo.svg',
			mimeType: 'image/svg+xml',
		},
	];
