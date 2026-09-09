import { clientCompanyName } from './branding';
import type {
	TrackingPageDocument,
	TrackingPageHistoryEvent,
} from './pages/TrackingPage';

export function buildTrackingPagePreviewMergeTags(
	taskTypeName: string,
): Record<string, string> {
	return {
		'task.headline': 'Your order has been delivered!',
		'task.job_title': '12345',
		'task.status': 'Completed',
		'task.task_type': taskTypeName,
		'task.destination_name': '123 Main St',
		'task.completed_at': 'Jan 15, 2026 2:30 PM',
		'task.external_key': 'EXT-001',
		'task.contact_name': 'Jane Smith',
		'company.name': clientCompanyName(),
	};
}

export const TRACKING_PAGE_PREVIEW_DOCUMENTS: TrackingPageDocument[] = [
	{ kind: 'delivery_docket', fileName: 'docket.pdf', available: true },
	{ kind: 'proof_of_completion', fileName: 'poc.pdf', available: true },
];

export const TRACKING_PAGE_PREVIEW_HISTORY: TrackingPageHistoryEvent[] = [
	{
		id: 'preview-1',
		type: 'status_change',
		at: new Date().toISOString(),
		title: 'Status changed to Completed',
		fromStatus: 'In Progress',
		toStatus: 'Completed',
		detail: null,
	},
];
