import type {
	WEB_AUTH_PROVIDER_ENTRA,
	WEB_AUTH_PROVIDER_STUB,
} from './webAuthProviders.js';

export interface EntraWebAuthConfig {
	clientId: string;
	tenantId: string;
}

export interface ResolvedWebAuth {
	provider: typeof WEB_AUTH_PROVIDER_STUB | typeof WEB_AUTH_PROVIDER_ENTRA;
	config: EntraWebAuthConfig | null;
}

export type WebAuthSource =
	| 'env'
	| typeof WEB_AUTH_PROVIDER_STUB
	| typeof WEB_AUTH_PROVIDER_ENTRA;

export function normalizeWebAuthProvider(
	value: unknown,
): typeof WEB_AUTH_PROVIDER_STUB | typeof WEB_AUTH_PROVIDER_ENTRA | null;

export function normalizeEntraWebAuthConfig(raw: unknown): EntraWebAuthConfig;

export function isEntraWebAuthConfigComplete(config: EntraWebAuthConfig): boolean;

export function resolveWebAuthFromParts(
	provider: typeof WEB_AUTH_PROVIDER_STUB | typeof WEB_AUTH_PROVIDER_ENTRA | null,
	config: unknown,
): ResolvedWebAuth;

export function envEntraWebAuthFallback(
	env: NodeJS.ProcessEnv | Record<string, string | undefined>,
): ResolvedWebAuth;

export function webAuthSourceFromDb(raw: unknown): WebAuthSource;

export function webAuthProviderForDb(
	source: WebAuthSource,
): typeof WEB_AUTH_PROVIDER_STUB | typeof WEB_AUTH_PROVIDER_ENTRA | null;
