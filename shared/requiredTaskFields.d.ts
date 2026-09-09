export const REQUIRED_TASK_FIELDS: {
	readonly externalKey: 'externalKey';
	readonly jobTitle: 'jobTitle';
	readonly taskDesc: 'taskDesc';
	readonly contacts: 'contacts';
	readonly destinationName: 'destinationName';
	readonly destinationAddress: 'destinationAddress';
	readonly destinationBuilding: 'destinationBuilding';
	readonly destinationNotes: 'destinationNotes';
	readonly afterDateTime: 'afterDateTime';
	readonly beforeDateTime: 'beforeDateTime';
	readonly crew: 'crew';
};

export const ALL_REQUIRED_TASK_FIELDS: readonly string[];
export const REQUIRED_TASK_FIELD_SET: ReadonlySet<string>;
export const REQUIRED_TASK_FIELD_LABELS: Record<string, string>;

export function requiredTaskFieldLabel(
	key: string,
	opts?: { externalKeyLabel?: string | null },
): string;

export function isTaskFieldRequired(keys: unknown, key: string): boolean;

export function requiredTaskFieldsFromDb(value: unknown): string[];

export function normalizeRequiredTaskFields(raw: unknown): string[];

export function isBlankTaskDesc(value: unknown): boolean;

export interface RequiredTaskFieldValues {
	externalKey?: unknown;
	jobTitle?: unknown;
	taskDesc?: unknown;
	contactIds?: unknown;
	destinationAddressName?: unknown;
	destinationAddress?: unknown;
	destinationBuilding?: unknown;
	destinationNotes?: unknown;
	afterDateTime?: unknown;
	beforeDateTime?: unknown;
	crewMemberIds?: unknown;
}

export function requiredTaskFieldError(
	values: RequiredTaskFieldValues,
	keys: unknown,
	opts?: { externalKeyLabel?: string | null },
): string | null;

export function assertRequiredTaskFields(
	values: RequiredTaskFieldValues,
	keys: unknown,
	opts?: { externalKeyLabel?: string | null },
): void;
