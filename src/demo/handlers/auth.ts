import { WEB_AUTH_PROVIDER_STUB } from '../../../shared/webAuthProviders.js';
import { getDemoStore } from '../store';
import { jsonResponse } from '../response';

export function handleGetAuthConfig(): Response {
	const { orgSettings } = getDemoStore();
	return jsonResponse({
		provider: WEB_AUTH_PROVIDER_STUB,
		config: null,
		accentColor: orgSettings.accentColor,
		logoUrl: orgSettings.logoUrl,
	});
}
