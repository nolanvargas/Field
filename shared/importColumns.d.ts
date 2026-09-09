export type ImportEntity = 'contacts' | 'addresses' | 'users';

export type ImportColumnDef = {
	key: string;
	header: string;
	required?: boolean;
	exportOnly?: boolean;
};

export type ImportCustomFieldDef = { slot: number; label: string };

export const IMPORT_ENTITIES: readonly ImportEntity[];
export const IMPORT_ENTITY_LABELS: Record<ImportEntity, string>;
export const IMPORT_COLUMNS: Record<ImportEntity, ImportColumnDef[]>;

export const IMPORT_CUSTOM_FIELD_ENTITY: Record<
	ImportEntity,
	import('./customFieldEntities.js').MasterDataCustomFieldEntity
>;

export function customFieldColumnKey(slot: number): string;

export function parseCustomFieldColumnKey(key: string): number | null;

export function customFieldImportColumns(
	defs: ImportCustomFieldDef[],
): ImportColumnDef[];

export function importColumnsForMode(
	entity: ImportEntity,
	mode?: 'template' | 'export',
	customFieldDefs?: ImportCustomFieldDef[],
): ImportColumnDef[];

export function importHeaders(
	entity: ImportEntity,
	mode?: 'template' | 'export',
	customFieldDefs?: ImportCustomFieldDef[],
): string[];

export function normalizeImportHeader(
	entity: ImportEntity,
	header: string,
	customFieldDefs?: ImportCustomFieldDef[],
): string | null;

export function importTemplateFilename(
	entity: ImportEntity,
	mode?: 'blank' | 'sample' | 'current',
): string;
