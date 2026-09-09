export type CustomFieldEntity = 'task' | 'user' | 'contact' | 'address';

export type MasterDataCustomFieldEntity = Exclude<CustomFieldEntity, 'task'>;

export const CUSTOM_FIELD_ENTITIES: {
	readonly task: 'task';
	readonly user: 'user';
	readonly contact: 'contact';
	readonly address: 'address';
};

export const ALL_CUSTOM_FIELD_ENTITIES: readonly CustomFieldEntity[];
export const CUSTOM_FIELD_ENTITY_SET: ReadonlySet<string>;
export const MASTER_DATA_CUSTOM_FIELD_ENTITIES: readonly MasterDataCustomFieldEntity[];
export const CUSTOM_FIELD_ENTITY_LABELS: Record<CustomFieldEntity, string>;

export function isCustomFieldEntity(value: unknown): value is CustomFieldEntity;

export function assertCustomFieldEntity(value: unknown): CustomFieldEntity;

export function byCustomFieldEntity<T>(
	makeValue: () => T,
): Record<CustomFieldEntity, T>;

export function customFieldDefsByEntityFrom(
	raw: unknown,
): Record<CustomFieldEntity, unknown[]>;
