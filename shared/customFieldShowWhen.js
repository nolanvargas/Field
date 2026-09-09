/**
 * Task custom-field visibility: show when the task type is one of a named set.
 * Empty / missing showWhen means always visible. Required is enforced only when visible.
 */

/**
 * @typedef {{ taskTypeNames: string[] }} CustomFieldShowWhen
 */

/**
 * @param {unknown} raw
 * @returns {CustomFieldShowWhen | null}
 */
export function normalizeShowWhen(raw) {
	if (raw == null) return null;
	if (typeof raw !== 'object' || Array.isArray(raw)) return null;
	const names = Array.isArray(
		/** @type {{ taskTypeNames?: unknown }} */ (raw).taskTypeNames,
	)
		? /** @type {{ taskTypeNames: unknown[] }} */ (raw).taskTypeNames
		: [];
	/** @type {string[]} */
	const out = [];
	const seen = new Set();
	for (const item of names) {
		const s = String(item ?? '').trim();
		if (!s) continue;
		const key = s.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(s);
	}
	return out.length > 0 ? { taskTypeNames: out } : null;
}

/**
 * @param {{ showWhen?: unknown } | null | undefined} def
 * @param {unknown} taskTypeName
 * @returns {boolean}
 */
export function isCustomFieldVisible(def, taskTypeName) {
	const showWhen = normalizeShowWhen(def?.showWhen);
	if (!showWhen) return true;
	const name = String(taskTypeName ?? '').trim();
	if (!name) return false;
	const key = name.toLowerCase();
	return showWhen.taskTypeNames.some((n) => n.toLowerCase() === key);
}
