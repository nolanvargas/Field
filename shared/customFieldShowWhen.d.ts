export interface CustomFieldShowWhen {
	taskTypeNames: string[];
}

export function normalizeShowWhen(raw: unknown): CustomFieldShowWhen | null;

export function isCustomFieldVisible(
	def: { showWhen?: unknown } | null | undefined,
	taskTypeName: unknown,
): boolean;
