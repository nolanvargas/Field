export const TASK_WEEK_HOVER_CARD_WIDTH = 400;
export const TASK_WEEK_HOVER_CARD_HEIGHT = 300;
export const TASK_WEEK_DAY_HOVER_CARD_WIDTH = 400;
export const TASK_WEEK_DAY_HOVER_CARD_HEIGHT = 180;
export const TASK_WEEK_HOVER_CARD_OFFSET = 12;
export const TASK_WEEK_HOVER_CARD_OPEN_DELAY_MS = 330;

export type TaskWeekHoverCardSize = {
	width: number;
	height: number;
};

export function clampTaskWeekHoverCardPosition(
	x: number,
	y: number,
	viewportWidth: number,
	viewportHeight: number,
	size: TaskWeekHoverCardSize = {
		width: TASK_WEEK_HOVER_CARD_WIDTH,
		height: TASK_WEEK_HOVER_CARD_HEIGHT,
	},
): { left: number; top: number } {
	const margin = 8;
	const { width, height } = size;
	let left = x + TASK_WEEK_HOVER_CARD_OFFSET;
	let top = y + TASK_WEEK_HOVER_CARD_OFFSET;

	if (left + width > viewportWidth - margin) {
		left = x - width - TASK_WEEK_HOVER_CARD_OFFSET;
	}
	if (top + height > viewportHeight - margin) {
		top = y - height - TASK_WEEK_HOVER_CARD_OFFSET;
	}

	left = Math.max(margin, Math.min(left, viewportWidth - width - margin));
	top = Math.max(margin, Math.min(top, viewportHeight - height - margin));

	return { left, top };
}
