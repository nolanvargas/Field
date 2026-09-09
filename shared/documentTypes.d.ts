export type DocumentTypeContext = 'task' | 'report';

export interface DocumentTypeDefinition {
	key: string;
	label: string;
	onTrackingPage: boolean;
	menuGroup?: string;
	context: DocumentTypeContext;
}

export declare const DOCUMENT_TYPES: readonly DocumentTypeDefinition[];
export declare const DOCUMENT_TYPE_KEYS: ReadonlySet<string>;

export function getDocumentType(key: unknown): DocumentTypeDefinition | null;
export function listDocumentTypes(): DocumentTypeDefinition[];
export function isValidDocumentType(key: unknown): boolean;
export function defaultTrackingDocumentKinds(): string[];
export function defaultTrackingPageDocumentKinds(taskTypeName: unknown): string[];
export function documentKindLabel(kind: unknown, count?: number): string;
export function documentGeneratedHistoryTitle(kind: unknown): string;
