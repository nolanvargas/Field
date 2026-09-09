export declare const WEB_AUTH_PROVIDER_STUB: "stub";
export declare const WEB_AUTH_PROVIDER_ENTRA: "entra";

export type WebAuthProviderId =
	| typeof WEB_AUTH_PROVIDER_STUB
	| typeof WEB_AUTH_PROVIDER_ENTRA;
