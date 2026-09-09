/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_API_BASE?: string;
	readonly VITE_AZURE_CLIENT_ID?: string;
	readonly VITE_AZURE_TENANT_ID?: string;
	readonly VITE_IMPORT_GOOGLE_SHEETS?: string;
	readonly VITE_PRODUCT_SUPPORT_EMAIL?: string;
	readonly VITE_PRODUCT_HELP_URL?: string;
	readonly VITE_PRODUCT_TERMS_URL?: string;
	readonly VITE_PRODUCT_PRIVACY_URL?: string;
	readonly VITE_PRODUCT_BILLING_URL?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
