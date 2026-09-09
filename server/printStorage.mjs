/** Storage paths and kinds for generated print PDFs. */

export const CURRENT_PRINT_STORAGE_PREFIX = 'documents/v5/';

/**
 * @param {string} documentType
 */
export function printStorageKind(documentType) {
	return String(documentType ?? '').trim();
}

/**
 * @param {string} documentType
 * @param {number} entityId
 */
export function printFileName(documentType, entityId) {
	const safeKey = String(documentType).replace(/[^\w-]+/g, '_');
	const safeId = String(entityId).replace(/[^\w-]+/g, '_');
	return `${safeKey}-${safeId}.pdf`;
}

/**
 * @param {string} documentType
 * @param {number} entityId
 */
export function printStorageKey(documentType, entityId) {
	return `${CURRENT_PRINT_STORAGE_PREFIX}${printFileName(documentType, entityId)}`;
}
