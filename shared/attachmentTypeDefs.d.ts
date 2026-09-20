import type { AttachmentMimeCategory } from './attachmentMimeCategories.js';
import type { CustomFieldShowWhen } from './customFieldShowWhen.js';

export function normalizeAttachmentTypeSlug(slug: unknown): string;

export function slugifyAttachmentTypeLabel(label: unknown): string;

export function isAttachmentTypeVisible(
	def: { showWhen?: unknown } | null | undefined,
	taskTypeName: unknown,
): boolean;

export interface MappedAttachmentTypeDefRow {
	id: number;
	slug: string;
	label: string;
	allowedMimeCategories: AttachmentMimeCategory[];
	showWhen: CustomFieldShowWhen | null;
	sortOrder: number;
}

export function mapAttachmentTypeDefRow(
	row: Record<string, unknown>,
): MappedAttachmentTypeDefRow;
