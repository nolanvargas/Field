import { IMPORT_ENTITIES } from './importColumns.js';

/** @typedef {import('./importColumns.js').ImportEntity} ImportEntity */

/** @typedef {Partial<Record<ImportEntity, string>>} ImportGoogleSheetsMap */

const COPY_URL_PREFIX = 'https://docs.google.com/spreadsheets/d/';
const COPY_URL_SUFFIX = '/copy';

/** @param {string} sheetId */
export function buildImportGoogleSheetCopyUrl(sheetId) {
	const id = normalizeImportGoogleSheetId(sheetId);
	return `${COPY_URL_PREFIX}${id}${COPY_URL_SUFFIX}`;
}

/**
 * Accept a bare spreadsheet ID or a full Google Sheets URL; return the ID.
 * @param {string} value
 * @returns {string}
 */
export function normalizeImportGoogleSheetId(value) {
	const trimmed = String(value ?? '').trim();
	if (!trimmed) {
		throw new Error('Google Sheet ID is required');
	}

	if (trimmed.includes('docs.google.com')) {
		const match = trimmed.match(/\/spreadsheets\/d\/([^/?#]+)/);
		if (!match?.[1]) {
			throw new Error(`Could not parse spreadsheet ID from URL: ${trimmed}`);
		}
		return match[1];
	}

	if (!/^[\w-]+$/.test(trimmed)) {
		throw new Error(`Invalid Google Sheet ID: ${trimmed}`);
	}

	return trimmed;
}

/**
 * @param {string} url
 * @returns {boolean}
 */
export function isValidImportGoogleSheetCopyUrl(url) {
	if (typeof url !== 'string') return false;
	const trimmed = url.trim();
	if (!trimmed.startsWith(COPY_URL_PREFIX) || !trimmed.endsWith(COPY_URL_SUFFIX)) {
		return false;
	}
	try {
		const parsed = new URL(trimmed);
		if (parsed.protocol !== 'https:') return false;
		if (!parsed.hostname.endsWith('google.com')) return false;
		return /^\/spreadsheets\/d\/[^/]+\/copy$/.test(parsed.pathname);
	} catch {
		return false;
	}
}

/**
 * Parse VITE_IMPORT_GOOGLE_SHEETS JSON (entity → spreadsheet ID).
 * IDs are expanded to https://docs.google.com/spreadsheets/d/{id}/copy.
 * @param {string | undefined | null} raw
 * @returns {ImportGoogleSheetsMap}
 */
export function parseImportGoogleSheets(raw) {
	if (raw == null || String(raw).trim() === '') return {};
	const text = String(raw).trim();
	if (text === '{}') return {};

	let parsed;
	try {
		parsed = JSON.parse(text);
	} catch {
		console.warn('VITE_IMPORT_GOOGLE_SHEETS is not valid JSON');
		return {};
	}

	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
		console.warn('VITE_IMPORT_GOOGLE_SHEETS must be a JSON object');
		return {};
	}

	/** @type {ImportGoogleSheetsMap} */
	const out = {};
	for (const entity of IMPORT_ENTITIES) {
		const value = parsed[entity];
		if (value == null || String(value).trim() === '') continue;
		try {
			out[entity] = buildImportGoogleSheetCopyUrl(String(value));
		} catch (err) {
			console.warn(`Skipping invalid ${entity} Google Sheet ID:`, err);
		}
	}
	return out;
}

/**
 * @param {ImportEntity} entity
 * @param {ImportGoogleSheetsMap | null | undefined} sheets
 * @returns {string | null}
 */
export function getImportGoogleSheetUrl(entity, sheets) {
	if (!sheets) return null;
	return sheets[entity] ?? null;
}
