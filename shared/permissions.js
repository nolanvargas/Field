/**
 * Extra (non-standard) access keys. `users.role` is a human label only —
 * never use it to grant or deny access.
 */

export const PERMISSIONS = {
	manageUsers: 'manage_users',
	manageOrg: 'manage_org',
	viewCrewMap: 'view_crew_map',
	viewAllTasks: 'view_all_tasks',
};

/** @type {readonly string[]} */
export const ALL_PERMISSIONS = Object.freeze([
	PERMISSIONS.manageUsers,
	PERMISSIONS.manageOrg,
	PERMISSIONS.viewCrewMap,
	PERMISSIONS.viewAllTasks,
]);

export const PERMISSION_SET = new Set(ALL_PERMISSIONS);

export const PERMISSION_LABELS = {
	[PERMISSIONS.manageUsers]: 'Manage users',
	[PERMISSIONS.manageOrg]: 'Manage organization',
	[PERMISSIONS.viewCrewMap]: 'View crew map',
	[PERMISSIONS.viewAllTasks]: 'View all tasks',
};

/**
 * @param {unknown} permissions
 * @param {string} key
 * @returns {boolean}
 */
export function hasPermission(permissions, key) {
	return Array.isArray(permissions) && permissions.includes(key);
}

/**
 * Drop unknown keys from a DB array. Does not throw.
 * @param {unknown} value
 * @returns {string[]}
 */
export function permissionsFromDb(value) {
	if (!Array.isArray(value)) return [];
	return value.filter(
		(key) => typeof key === 'string' && PERMISSION_SET.has(key),
	);
}

/**
 * Validate a PATCH body permissions array. Unknown keys → 400.
 * @param {unknown} raw
 * @returns {string[]}
 */
export function normalizePermissions(raw) {
	if (raw == null) {
		throw Object.assign(new Error('permissions is required'), { status: 400 });
	}
	if (!Array.isArray(raw)) {
		throw Object.assign(new Error('permissions must be an array'), {
			status: 400,
		});
	}
	const seen = new Set();
	const out = [];
	for (const item of raw) {
		if (typeof item !== 'string' || !item.trim()) {
			throw Object.assign(new Error('Each permission must be a string'), {
				status: 400,
			});
		}
		const key = item.trim();
		if (!PERMISSION_SET.has(key)) {
			throw Object.assign(new Error(`Unknown permission: ${key}`), {
				status: 400,
			});
		}
		if (!seen.has(key)) {
			seen.add(key);
			out.push(key);
		}
	}
	return out;
}

/**
 * True when the actor would strip their own `manage_users` key.
 * @param {string} actorUserId
 * @param {string} targetUserId
 * @param {unknown} nextPermissions
 * @returns {boolean}
 */
export function wouldRemoveOwnManageUsers(
	actorUserId,
	targetUserId,
	nextPermissions,
) {
	if (!actorUserId || actorUserId !== targetUserId) return false;
	return !hasPermission(nextPermissions, PERMISSIONS.manageUsers);
}
