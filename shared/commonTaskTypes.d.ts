export interface CommonTaskType {
	readonly name: string;
	readonly pluralName: string;
	readonly icon: string;
}

export const COMMON_TASK_TYPES: readonly CommonTaskType[];

export function commonTaskTypeByName(name: string): CommonTaskType | undefined;
