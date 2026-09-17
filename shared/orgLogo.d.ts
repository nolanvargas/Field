export type OrgLogoMimeType =
	| 'image/png'
	| 'image/jpeg'
	| 'image/webp'
	| 'image/svg+xml';

export const ORG_LOGO_STORAGE_KEY: 'org-branding/logo';
export const ORG_LOGO_MAX_BYTES: number;
export const ORG_LOGO_ALLOWED_MIME_TYPES: readonly OrgLogoMimeType[];

export function normalizeOrgLogoMimeType(
	mimeType: string | null | undefined,
): OrgLogoMimeType | null;

export function orgLogoPublicPath(
	updatedAt: string | null | undefined,
): string | null;
