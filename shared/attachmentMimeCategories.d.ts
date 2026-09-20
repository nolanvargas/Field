export type AttachmentMimeCategory = 'image' | 'video' | 'pdf' | 'other';

export const ATTACHMENT_MIME_CATEGORIES: readonly AttachmentMimeCategory[];
export const ATTACHMENT_MIME_CATEGORY_SET: ReadonlySet<AttachmentMimeCategory>;
export const DEFAULT_ATTACHMENT_MIME_CATEGORIES: readonly AttachmentMimeCategory[];

export function mimeToAttachmentCategory(mimeType: string): AttachmentMimeCategory;

export function normalizeAttachmentMimeCategories(
	raw: unknown,
): AttachmentMimeCategory[];

export function mimeMatchesAttachmentCategories(
	mimeType: string,
	categories: AttachmentMimeCategory[],
): boolean;

export function allowedMimeTypesForCategories(
	categories: AttachmentMimeCategory[],
): ReadonlySet<string>;
