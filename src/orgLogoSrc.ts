import { apiUrl } from './api/client';

/** Resolve a server-relative org logo URL for img src (Capacitor-safe). */
export function orgLogoSrc(logoUrl: string | null | undefined): string | null {
	if (!logoUrl) return null;
	if (logoUrl.startsWith('http://') || logoUrl.startsWith('https://')) {
		return logoUrl;
	}
	return apiUrl(logoUrl);
}
