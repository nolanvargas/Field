import { SANDBOCKS } from '../shared/officialOrgs.js';

/** Client-visible organization branding (set via Vite env / .env). */
export function clientCompanyName(): string {
	const raw = import.meta.env.VITE_COMPANY_NAME as string | undefined;
	return raw?.trim() || SANDBOCKS.displayName;
}

export function clientSupportEmail(): string {
	const raw = import.meta.env.VITE_COMPANY_SUPPORT_EMAIL as string | undefined;
	return raw?.trim() || 'support@example.com';
}
