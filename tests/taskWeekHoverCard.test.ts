import { describe, expect, it } from 'vitest';
import {
	clampTaskWeekHoverCardPosition,
	TASK_WEEK_DAY_HOVER_CARD_HEIGHT,
	TASK_WEEK_DAY_HOVER_CARD_WIDTH,
	TASK_WEEK_HOVER_CARD_HEIGHT,
	TASK_WEEK_HOVER_CARD_OFFSET,
	TASK_WEEK_HOVER_CARD_WIDTH,
} from '../src/components/taskWeekHoverCard';

describe('clampTaskWeekHoverCardPosition', () => {
	it('places the card below and to the right of the cursor by default', () => {
		const pos = clampTaskWeekHoverCardPosition(100, 100, 1200, 800);
		expect(pos).toEqual({
			left: 100 + TASK_WEEK_HOVER_CARD_OFFSET,
			top: 100 + TASK_WEEK_HOVER_CARD_OFFSET,
		});
	});

	it('flips left when the card would overflow the viewport width', () => {
		const x = 1100;
		const y = 100;
		const pos = clampTaskWeekHoverCardPosition(x, y, 1200, 800);
		expect(pos.left).toBe(
			x - TASK_WEEK_HOVER_CARD_WIDTH - TASK_WEEK_HOVER_CARD_OFFSET,
		);
	});

	it('flips up when the card would overflow the viewport height', () => {
		const x = 100;
		const y = 700;
		const pos = clampTaskWeekHoverCardPosition(x, y, 1200, 800);
		expect(pos.top).toBe(
			y - TASK_WEEK_HOVER_CARD_HEIGHT - TASK_WEEK_HOVER_CARD_OFFSET,
		);
	});

	it('uses custom dimensions for day hover cards', () => {
		const x = 1100;
		const y = 100;
		const pos = clampTaskWeekHoverCardPosition(x, y, 1200, 800, {
			width: TASK_WEEK_DAY_HOVER_CARD_WIDTH,
			height: TASK_WEEK_DAY_HOVER_CARD_HEIGHT,
		});
		expect(pos.left).toBe(
			x - TASK_WEEK_DAY_HOVER_CARD_WIDTH - TASK_WEEK_HOVER_CARD_OFFSET,
		);
	});
});
