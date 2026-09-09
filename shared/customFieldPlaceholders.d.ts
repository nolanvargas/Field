export const CUSTOM_FIELD_IMPORT_PLACEHOLDER: '__field_import_unset__';

export const CUSTOM_FIELD_UNDEFINED_DISPLAY: 'undefined';

export function isCustomFieldImportPlaceholder(value: unknown): boolean;

export function stripCustomFieldImportPlaceholders(
	values: Record<string, unknown> | null | undefined,
): Record<string, unknown>;
