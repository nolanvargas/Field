export function parseTaskTypeUrlFilter(
	raw: string | null,
	allowed: readonly string[],
): string[];

export function serializeTaskTypeUrlFilter(filters: string[]): string | null;
