import type { ImportEntity } from './importColumns.js';

export type ImportGoogleSheetsMap = Partial<Record<ImportEntity, string>>;

export function buildImportGoogleSheetCopyUrl(sheetId: string): string;
export function normalizeImportGoogleSheetId(value: string): string;
export function isValidImportGoogleSheetCopyUrl(url: string): boolean;
export function parseImportGoogleSheets(
	raw: string | undefined | null,
): ImportGoogleSheetsMap;
export function getImportGoogleSheetUrl(
	entity: ImportEntity,
	sheets: ImportGoogleSheetsMap | null | undefined,
): string | null;
