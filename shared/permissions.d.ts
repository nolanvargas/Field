export const PERMISSIONS: {
	readonly manageUsers: 'manage_users';
	readonly manageOrg: 'manage_org';
	readonly viewCrewMap: 'view_crew_map';
	readonly viewAllTasks: 'view_all_tasks';
};

export const ALL_PERMISSIONS: readonly string[];
export const PERMISSION_SET: ReadonlySet<string>;
export const PERMISSION_LABELS: Record<string, string>;

export function hasPermission(permissions: unknown, key: string): boolean;
export function permissionsFromDb(value: unknown): string[];
export function normalizePermissions(raw: unknown): string[];
export function wouldRemoveOwnManageUsers(
	actorUserId: string,
	targetUserId: string,
	nextPermissions: unknown,
): boolean;
