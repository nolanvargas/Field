import type { TrackingPageTemplate } from '../shared/trackingPageTemplate.js';

export const TRACKING_PAGE_PREVIEW_STORAGE_KEY = 'field-tracking-page-preview';

export interface TrackingPagePreviewPayload {
	taskTypeName: string;
	trackingPageTemplate: TrackingPageTemplate;
	accentColor: string;
}

export function writeTrackingPagePreview(payload: TrackingPagePreviewPayload): void {
	// localStorage is shared across tabs; sessionStorage is not.
	localStorage.setItem(TRACKING_PAGE_PREVIEW_STORAGE_KEY, JSON.stringify(payload));
}

export function readTrackingPagePreview(): TrackingPagePreviewPayload | null {
	const raw = localStorage.getItem(TRACKING_PAGE_PREVIEW_STORAGE_KEY);
	if (!raw) return null;
	try {
		const parsed = JSON.parse(raw) as TrackingPagePreviewPayload;
		if (
			!parsed ||
			typeof parsed.taskTypeName !== 'string' ||
			!parsed.trackingPageTemplate ||
			typeof parsed.accentColor !== 'string'
		) {
			return null;
		}
		return parsed;
	} catch {
		return null;
	}
}

export function openTrackingPagePreview(payload: TrackingPagePreviewPayload): void {
	writeTrackingPagePreview(payload);
	window.open('/tracking-page-preview', '_blank', 'noopener,noreferrer');
}
