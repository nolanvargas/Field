export type TaskSearchSubmitResult = 'idle' | 'not-found' | 'task' | 'results';

/** One match opens the task. A list that is already open stays open for any count. */
export function resolveTaskSearchOutcome(
	matchCount: number,
	resultsAlreadyOpen: boolean,
): Exclude<TaskSearchSubmitResult, 'idle'> {
	if (matchCount <= 0 && !resultsAlreadyOpen) return 'not-found';
	if (matchCount === 1 && !resultsAlreadyOpen) return 'task';
	return 'results';
}
