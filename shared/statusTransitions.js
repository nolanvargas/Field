/**
 * Allowed manual/admin status transitions.
 * Shared by API (server/createTask.mjs) and TaskDetailModal.
 */

/** @type {Record<string, string[]>} */
export const STATUS_TRANSITIONS = {
	Unassigned: ['Assigned'],
	Assigned: ['In Progress', 'Failed'],
	'In Progress': ['Completed', 'Failed', 'Undetermined'],
	Completed: ['In Progress', 'Failed', 'Undetermined'],
	Failed: ['Completed', 'Undetermined'],
	Undetermined: ['Completed', 'Failed'],
	Cancelled: [],
};

/**
 * @param {string | undefined} _taskType
 * @returns {Record<string, string[]>}
 */
export function statusTransitionsFor(_taskType) {
	return STATUS_TRANSITIONS;
}
