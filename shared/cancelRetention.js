/**
 * Cancelled-task retention helpers.
 * Per-task archive_at is set at cancel time; restore/purge use that frozen deadline.
 */

/**
 * @param {string | null | undefined} archiveAt ISO timestamp when the task will be archived
 * @returns {boolean}
 */
export function isRestoreWindowOpenFromArchiveAt(archiveAt) {
	if (archiveAt == null) return true;
	const ms = new Date(archiveAt).getTime();
	if (Number.isNaN(ms)) return false;
	return Date.now() < ms;
}

/**
 * @param {string | null | undefined} archiveAt
 */
export function assertRestoreWindowOpenFromArchiveAt(archiveAt) {
	if (isRestoreWindowOpenFromArchiveAt(archiveAt)) return;
	throw Object.assign(
		new Error(
			'Restore window has expired; this cancelled task may have been archived',
		),
		{ status: 409 },
	);
}

/** @deprecated Use per-task archiveAt; kept for unit tests of day arithmetic. */
export function archiveAtFromCancelledAt(cancelledAt, retentionDays) {
	if (!cancelledAt || retentionDays == null) return null;
	const ms = new Date(cancelledAt).getTime();
	if (Number.isNaN(ms)) return null;
	return new Date(ms + retentionDays * 24 * 60 * 60 * 1000).toISOString();
}

/** @deprecated Use isRestoreWindowOpenFromArchiveAt */
export function isRestoreWindowOpen(cancelledAt, retentionDays) {
	if (retentionDays == null) return true;
	const archiveAt = archiveAtFromCancelledAt(cancelledAt, retentionDays);
	if (!archiveAt) return false;
	return Date.now() < new Date(archiveAt).getTime();
}

/** @deprecated Use assertRestoreWindowOpenFromArchiveAt */
export function assertRestoreWindowOpen(cancelledAt, retentionDays) {
	if (isRestoreWindowOpen(cancelledAt, retentionDays)) return;
	throw Object.assign(
		new Error(
			'Restore window has expired; this cancelled task may have been archived',
		),
		{ status: 409 },
	);
}
