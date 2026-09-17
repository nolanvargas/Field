/** @typedef {'image/png' | 'image/jpeg' | 'image/webp' | 'image/svg+xml'} OrgLogoMimeType */

export const ORG_LOGO_STORAGE_KEY = 'org-branding/logo';

export const ORG_LOGO_MAX_BYTES = 1024 * 1024;

/** @type {readonly OrgLogoMimeType[]} */
export const ORG_LOGO_ALLOWED_MIME_TYPES = Object.freeze([
	'image/png',
	'image/jpeg',
	'image/webp',
	'image/svg+xml',
]);

const MIME_SET = new Set(ORG_LOGO_ALLOWED_MIME_TYPES);

/**
 * @param {string | null | undefined} mimeType
 * @returns {OrgLogoMimeType | null}
 */
export function normalizeOrgLogoMimeType(mimeType) {
	const normalized = String(mimeType ?? '')
		.trim()
		.toLowerCase();
	if (normalized === 'image/jpg') return 'image/jpeg';
	return MIME_SET.has(normalized) ? /** @type {OrgLogoMimeType} */ (normalized) : null;
}

/**
 * @param {string | null | undefined} updatedAt
 * @returns {string | null}
 */
export function orgLogoPublicPath(updatedAt) {
	if (!updatedAt) return null;
	const ms = new Date(updatedAt).getTime();
	if (!Number.isFinite(ms) || ms <= 0) return null;
	return `/api/org/logo?v=${ms}`;
}
