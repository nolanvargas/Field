/**
 * Global document type registry — business slots for generated/stored PDFs.
 * Per-org layouts live in org_print_templates; this defines labels and visibility.
 */

/** @typedef {'task' | 'report'} DocumentTypeContext */

/**
 * @typedef {{
 *   key: string,
 *   label: string,
 *   onTrackingPage: boolean,
 *   menuGroup?: string,
 *   context: DocumentTypeContext,
 * }} DocumentTypeDefinition
 */

/** @type {readonly DocumentTypeDefinition[]} */
export const DOCUMENT_TYPES = Object.freeze([
	{
		key: 'delivery_docket',
		label: 'Delivery docket',
		onTrackingPage: true,
		menuGroup: 'Documents',
		context: 'task',
	},
	{
		key: 'proof_of_completion',
		label: 'Proof of completion',
		onTrackingPage: true,
		context: 'task',
	},
	{
		key: 'shipping_label',
		label: 'Shipping label',
		onTrackingPage: false,
		context: 'task',
	},
	{
		key: 'invoice',
		label: 'Invoice',
		onTrackingPage: false,
		context: 'task',
	},
]);

/** @type {ReadonlySet<string>} */
export const DOCUMENT_TYPE_KEYS = new Set(DOCUMENT_TYPES.map((t) => t.key));

/**
 * @param {unknown} key
 * @returns {DocumentTypeDefinition | null}
 */
export function getDocumentType(key) {
	const normalized = String(key ?? '').trim();
	if (!normalized) return null;
	return DOCUMENT_TYPES.find((t) => t.key === normalized) ?? null;
}

/**
 * @returns {DocumentTypeDefinition[]}
 */
export function listDocumentTypes() {
	return [...DOCUMENT_TYPES];
}

/**
 * @param {unknown} key
 * @returns {boolean}
 */
export function isValidDocumentType(key) {
	return DOCUMENT_TYPE_KEYS.has(String(key ?? '').trim());
}

/**
 * Document kinds shown on customer tracking pages by default.
 * @returns {string[]}
 */
export function defaultTrackingDocumentKinds() {
	return DOCUMENT_TYPES.filter((t) => t.onTrackingPage).map((t) => t.key);
}

/**
 * Public document kinds for a task type (delivery docket is Delivery-only).
 * @param {unknown} taskTypeName
 * @returns {string[]}
 */
export function defaultTrackingPageDocumentKinds(taskTypeName) {
	const kinds = defaultTrackingDocumentKinds();
	if (String(taskTypeName ?? '').trim() === 'Delivery') return kinds;
	return kinds.filter((k) => k !== 'delivery_docket');
}

/**
 * @param {unknown} kind
 * @param {number} [count]
 * @returns {string}
 */
export function documentKindLabel(kind, count = 1) {
	const docType = getDocumentType(kind);
	if (docType) {
		return count === 1 ? docType.label : `${docType.label}s`;
	}
	const normalized = String(kind ?? '').trim();
	if (!normalized) return count === 1 ? 'Document' : 'Documents';
	const label = normalized.replace(/_/g, ' ');
	return count === 1 ? label : `${label}s`;
}

/**
 * @param {unknown} kind
 * @returns {string}
 */
export function documentGeneratedHistoryTitle(kind) {
	const docType = getDocumentType(kind);
	if (docType) return `${docType.label} available`;
	return 'Document available';
}
