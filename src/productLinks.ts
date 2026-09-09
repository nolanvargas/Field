import { hasPermission, PERMISSIONS } from '../shared/permissions.js';

export type ProductLinkId =
	| 'support'
	| 'help'
	| 'terms'
	| 'privacy'
	| 'billing';

export type ProductLink = {
	id: ProductLinkId;
	label: string;
	href: string;
	external: boolean;
	permission?: string;
};

const DEFAULT_SUPPORT_EMAIL = 'support@example.com';
const DEFAULT_HELP_URL = 'https://example.com/help';
const DEFAULT_TERMS_URL = 'https://example.com/terms';
const DEFAULT_PRIVACY_URL = 'https://example.com/privacy';
const DEFAULT_BILLING_URL = 'https://example.com/billing';

function envTrim(key: keyof ImportMetaEnv): string {
	const raw = import.meta.env[key] as string | undefined;
	return raw?.trim() ?? '';
}

function allProductLinks(): ProductLink[] {
	const supportEmail =
		envTrim('VITE_PRODUCT_SUPPORT_EMAIL') || DEFAULT_SUPPORT_EMAIL;
	const helpUrl = envTrim('VITE_PRODUCT_HELP_URL') || DEFAULT_HELP_URL;
	const termsUrl = envTrim('VITE_PRODUCT_TERMS_URL') || DEFAULT_TERMS_URL;
	const privacyUrl =
		envTrim('VITE_PRODUCT_PRIVACY_URL') || DEFAULT_PRIVACY_URL;
	const billingUrl =
		envTrim('VITE_PRODUCT_BILLING_URL') || DEFAULT_BILLING_URL;

	return [
		{
			id: 'support',
			label: 'Support',
			href: `mailto:${supportEmail}`,
			external: false,
		},
		{
			id: 'help',
			label: 'Help',
			href: helpUrl,
			external: true,
		},
		{
			id: 'terms',
			label: 'Terms',
			href: termsUrl,
			external: true,
		},
		{
			id: 'privacy',
			label: 'Privacy',
			href: privacyUrl,
			external: true,
		},
		{
			id: 'billing',
			label: 'Billing',
			href: billingUrl,
			external: true,
			permission: PERMISSIONS.manageOrg,
		},
	];
}

function filterByPermission(
	links: ProductLink[],
	permissions: unknown,
): ProductLink[] {
	return links.filter(
		(link) =>
			!link.permission || hasPermission(permissions, link.permission),
	);
}

/** Product links visible in the authenticated shell (sidebar + More). */
export function getVisibleProductLinks(options?: {
	permissions?: unknown;
}): ProductLink[] {
	return filterByPermission(allProductLinks(), options?.permissions);
}

/** Legal links only (terms + privacy). */
export function getLegalProductLinks(options?: {
	permissions?: unknown;
}): ProductLink[] {
	return getVisibleProductLinks(options).filter(
		(link) => link.id === 'terms' || link.id === 'privacy',
	);
}

/** Non-legal action links (support, help, billing). */
export function getActionProductLinks(options?: {
	permissions?: unknown;
}): ProductLink[] {
	return getVisibleProductLinks(options).filter(
		(link) => link.id !== 'terms' && link.id !== 'privacy',
	);
}

/** Pre-auth pages: support, help, legal — no billing. */
export function getAuthProductLinks(): ProductLink[] {
	return allProductLinks().filter((link) => link.id !== 'billing');
}
