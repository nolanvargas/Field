import { apiFetch, expectOk } from './client';
import {
	ORG_LOGO_ALLOWED_MIME_TYPES,
	ORG_LOGO_MAX_BYTES,
} from '../../shared/orgLogo.js';

export { ORG_LOGO_ALLOWED_MIME_TYPES, ORG_LOGO_MAX_BYTES };

export function validateOrgLogoFile(file: File): string | null {
	if (!ORG_LOGO_ALLOWED_MIME_TYPES.includes(file.type as (typeof ORG_LOGO_ALLOWED_MIME_TYPES)[number])) {
		return 'Logo must be PNG, JPEG, WebP, or SVG';
	}
	if (file.size > ORG_LOGO_MAX_BYTES) {
		return 'Logo exceeds 1 MB limit';
	}
	return null;
}

function orgLogoWritePath(actorUserId?: string): string {
	const params = new URLSearchParams();
	if (actorUserId) params.set('actorUserId', actorUserId);
	const qs = params.toString();
	return qs ? `/api/org/logo?${qs}` : '/api/org/logo';
}

export async function uploadOrgLogo(
	file: File,
	actorUserId?: string,
	signal?: AbortSignal,
): Promise<{ logoUrl: string }> {
	const form = new FormData();
	form.append('file', file);
	const res = await apiFetch(orgLogoWritePath(actorUserId), {
		method: 'POST',
		body: form,
		signal,
	});
	return expectOk(res, 'Upload org logo failed');
}

export async function deleteOrgLogo(
	actorUserId?: string,
	signal?: AbortSignal,
): Promise<{ logoUrl: null }> {
	const res = await apiFetch(orgLogoWritePath(actorUserId), {
		method: 'DELETE',
		signal,
	});
	return expectOk(res, 'Remove org logo failed');
}
