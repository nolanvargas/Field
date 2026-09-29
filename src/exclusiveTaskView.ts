export type ExclusiveTaskAction =
	| { kind: 'page'; path: string }
	| { kind: 'modal'; taskId: number };

/** An exclusive task view is the mobile page or the desktop modal, never both. */
export function exclusiveTaskAction(
	taskId: number,
	compactUi: boolean,
): ExclusiveTaskAction {
	if (compactUi) {
		return { kind: 'page', path: `/task/${taskId}` };
	}
	return { kind: 'modal', taskId };
}
