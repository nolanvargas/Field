export type TrackingPageBlockType =
	| 'text'
	| 'spacer'
	| 'detailRows'
	| 'documents'
	| 'history'
	| 'imageAttachments';

export type TrackingPageTextBlock = {
	id: string;
	type: 'text';
	html: string;
};

export type TrackingPageSpacerBlock = {
	id: string;
	type: 'spacer';
	size: 'sm' | 'md' | 'lg';
};

export type TrackingPageDetailRowsBlock = {
	id: string;
	type: 'detailRows';
	rows: { label: string; tag: string }[];
};

export type TrackingPageDocumentsBlock = {
	id: string;
	type: 'documents';
	kinds: string[];
};

export type TrackingPageHistoryBlock = {
	id: string;
	type: 'history';
};

export type TrackingPageImageAttachmentsBlock = {
	id: string;
	type: 'imageAttachments';
};

export type TrackingPageBlock =
	| TrackingPageTextBlock
	| TrackingPageSpacerBlock
	| TrackingPageDetailRowsBlock
	| TrackingPageDocumentsBlock
	| TrackingPageHistoryBlock
	| TrackingPageImageAttachmentsBlock;

export type TrackingPageTemplate = {
	version: 2;
	blocks: TrackingPageBlock[];
};

export const TRACKING_PAGE_TEMPLATE_VERSION: 2;
export const TRACKING_PAGE_BLOCK_TYPES: readonly TrackingPageBlockType[];
export const TRACKING_PAGE_BLOCK_LABELS: Record<TrackingPageBlockType, string>;
export const TRACKING_PAGE_SINGLETON_BLOCK_TYPES: readonly TrackingPageBlockType[];
export const TRACKING_PAGE_MERGE_TAGS: readonly string[];

export function defaultTrackingPageTemplate(
	taskTypeName: string,
): TrackingPageTemplate;
export function normalizeTrackingPageTemplate(
	raw: unknown,
	taskTypeName?: string,
): TrackingPageTemplate;
export function trackingPageTemplateFromDb(
	dbValue: unknown,
	taskTypeName: string,
): TrackingPageTemplate;
export function snapshotTrackingPageTemplate(
	template: unknown,
	taskTypeName?: string,
): string;
export function defaultBlock(
	blockType: TrackingPageBlockType,
	taskTypeName?: string,
): TrackingPageBlock;
export function substituteMergeTags(
	html: string,
	tagMap: Record<string, string>,
): string;
export function newBlockId(prefix?: string): string;
export function canAddTrackingPageBlockType(
	blockType: TrackingPageBlockType,
	blocks: TrackingPageBlock[],
): boolean;

