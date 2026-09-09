import {
	type Configuration,
	LogLevel,
	PublicClientApplication,
} from '@azure/msal-browser';
import { getActiveWebAuthProvider, getEntraClientConfig, isWebAuthEnabled } from './webAuthConfig';
import { WEB_AUTH_PROVIDER_ENTRA } from '../../shared/webAuthProviders.js';

function buildMsalConfig(entra: { clientId: string; tenantId: string }): Configuration {
	const redirectUri =
		typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';

	return {
		auth: {
			clientId: entra.clientId,
			authority: `https://login.microsoftonline.com/${entra.tenantId}`,
			redirectUri,
			postLogoutRedirectUri: redirectUri,
		},
		cache: {
			cacheLocation: 'sessionStorage',
		},
		system: {
			loggerOptions: {
				logLevel: LogLevel.Warning,
				loggerCallback: (_level, message, containsPii) => {
					if (!containsPii) console.debug('[msal]', message);
				},
			},
		},
	};
}

export const loginRequest = {
	scopes: ['openid', 'profile', 'email', 'User.Read'],
};

let pca: PublicClientApplication | null = null;
let pcaKey: string | null = null;

export function getMsalInstance(): PublicClientApplication {
	if (!isWebAuthEnabled() || getActiveWebAuthProvider() !== WEB_AUTH_PROVIDER_ENTRA) {
		throw new Error('Entra ID is not configured');
	}
	const entra = getEntraClientConfig();
	if (!entra) {
		throw new Error('Entra ID is not configured');
	}
	const key = `${entra.tenantId}:${entra.clientId}`;
	if (!pca || pcaKey !== key) {
		pca = new PublicClientApplication(buildMsalConfig(entra));
		pcaKey = key;
	}
	return pca;
}
