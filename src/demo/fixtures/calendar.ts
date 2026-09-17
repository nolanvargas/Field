/** Month-grid helpers aligned with scripts/lib/seedDevTasksEnrich.mjs (scaled for demo). */

function parseCalendarDayKey(key: string): Date {
	const [y, m, d] = key.split('-').map(Number);
	return new Date(y, m - 1, d);
}

function formatCalendarDayKey(date: Date): string {
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function pacificTodayKey(): string {
	return new Intl.DateTimeFormat('en-CA', {
		timeZone: 'America/Los_Angeles',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	}).format(new Date());
}

/** 6-week Sun-start grid for the month of `focusDayKey` (matches TaskMonthView). */
export function monthGridDayKeys(focusDayKey: string): string[] {
	const focus = parseCalendarDayKey(focusDayKey);
	const year = focus.getFullYear();
	const month = focus.getMonth();
	const gridStart = new Date(year, month, 1);
	gridStart.setDate(gridStart.getDate() - gridStart.getDay());

	const keys: string[] = [];
	for (let i = 0; i < 42; i++) {
		const d = new Date(gridStart);
		d.setDate(gridStart.getDate() + i);
		keys.push(formatCalendarDayKey(d));
	}
	return keys;
}

function seedMix(seed: number, salt: number): number {
	return ((seed * 1103515245 + salt * 12345) >>> 0) % 10000;
}

function seededRandInt(seed: number, salt: number, min: number, max: number): number {
	const span = max - min + 1;
	return min + (seedMix(seed, salt) % span);
}

function seededShuffle(items: number[], seed: number): number[] {
	for (let i = items.length - 1; i > 0; i--) {
		const j = seedMix(seed, 400 + i) % (i + 1);
		[items[i], items[j]] = [items[j], items[i]];
	}
	return items;
}

function normalizeCountList(counts: number[], targetSum: number, minValue: number): void {
	let sum = counts.reduce((a, b) => a + b, 0);
	if (sum === targetSum) return;

	if (sum > targetSum) {
		const order = counts
			.map((value, index) => ({ value, index }))
			.sort((a, b) => b.value - a.value);
		let cursor = 0;
		while (sum > targetSum) {
			const slot = order[cursor % order.length];
			if (counts[slot.index] > minValue) {
				counts[slot.index] -= 1;
				sum -= 1;
			}
			cursor += 1;
			if (cursor > counts.length * (sum - targetSum + 500)) break;
		}
		return;
	}

	const order = counts
		.map((value, index) => ({ value, index }))
		.sort((a, b) => a.value - b.value);
	let cursor = 0;
	while (sum < targetSum) {
		const slot = order[cursor % order.length];
		counts[slot.index] += 1;
		sum += 1;
		cursor += 1;
		if (cursor > counts.length * (targetSum - sum + 500)) break;
	}
}

function allocateRandomWeekdayCounts(
	slotCount: number,
	budget: number,
	minValue: number,
	seed: number,
): number[] {
	const counts = Array(slotCount).fill(minValue);
	let remaining = budget - minValue * slotCount;
	if (remaining < 0) {
		throw new Error(`Weekday budget ${budget} below minimum ${minValue * slotCount}`);
	}
	const weights = counts.map((_, index) => 1 + (seedMix(seed, 100 + index) % 100));
	const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
	for (let index = 0; index < slotCount; index++) {
		counts[index] += Math.floor((remaining * weights[index]) / weightSum);
	}
	normalizeCountList(counts, budget, minValue);
	return counts;
}

function heatmapSeedFromFocusDay(focusDayKey: string): number {
	const compact = focusDayKey.replaceAll('-', '');
	return Number.parseInt(compact, 10) || 20260911;
}

const DEMO_SUNDAY_MIN = 0;
const DEMO_SUNDAY_MAX = 2;
const DEMO_SATURDAY_MIN = 2;
const DEMO_SATURDAY_MAX = 4;
const DEMO_WEEKDAY_MIN = 2;

function heatmapCountFloor(key: string): number {
	const dow = parseCalendarDayKey(key).getDay();
	if (dow === 0) return DEMO_SUNDAY_MIN;
	if (dow === 6) return DEMO_SATURDAY_MIN;
	return DEMO_WEEKDAY_MIN;
}

function rebalanceHeatmapTargets(
	targets: Map<string, number>,
	gridKeys: string[],
	baseByDay: Map<string, number>,
	totalTarget: number,
): void {
	let sum = [...targets.values()].reduce((a, b) => a + b, 0);
	let delta = totalTarget - sum;
	if (delta === 0) return;

	const slots = gridKeys.map((key) => ({
		key,
		floor: Math.max(heatmapCountFloor(key), baseByDay.get(key) ?? 0),
		target: targets.get(key) ?? 0,
	}));

	let guard = 0;
	while (delta !== 0 && guard < gridKeys.length * (Math.abs(delta) + 2000)) {
		const ordered = [...slots].sort((a, b) =>
			delta > 0 ? a.target - b.target : b.target - a.target,
		);
		let moved = false;
		for (const slot of ordered) {
			if (delta > 0) {
				slot.target += 1;
				targets.set(slot.key, slot.target);
				delta -= 1;
				moved = true;
				break;
			}
			if (slot.target > slot.floor) {
				slot.target -= 1;
				targets.set(slot.key, slot.target);
				delta += 1;
				moved = true;
				break;
			}
		}
		if (!moved) break;
		guard += 1;
	}
}

/**
 * Deterministic per-day counts for the month-grid heatmap (demo scale).
 */
export function buildDemoHeatmapDayTargets(
	focusDayKey: string,
	totalTarget: number,
	baseByDay = new Map<string, number>(),
): Map<string, number> {
	const gridKeys = monthGridDayKeys(focusDayKey);
	const sundayKeys: string[] = [];
	const saturdayKeys: string[] = [];
	const monFriKeys: string[] = [];
	for (const key of gridKeys) {
		const dow = parseCalendarDayKey(key).getDay();
		if (dow === 0) sundayKeys.push(key);
		else if (dow === 6) saturdayKeys.push(key);
		else monFriKeys.push(key);
	}

	const seed = heatmapSeedFromFocusDay(focusDayKey);
	const sundayCounts = sundayKeys.map((_, index) =>
		seededRandInt(seed, index, DEMO_SUNDAY_MIN, DEMO_SUNDAY_MAX),
	);
	const saturdayCounts = saturdayKeys.map((_, index) =>
		seededRandInt(seed, 20 + index, DEMO_SATURDAY_MIN, DEMO_SATURDAY_MAX),
	);
	const weekendSum =
		sundayCounts.reduce((sum, value) => sum + value, 0) +
		saturdayCounts.reduce((sum, value) => sum + value, 0);
	const weekdayBudget = totalTarget - weekendSum;
	const weekdayMinSum = monFriKeys.length * DEMO_WEEKDAY_MIN;
	if (weekdayBudget < weekdayMinSum) {
		throw new Error(
			`Demo heatmap weekday budget ${weekdayBudget} too small for ${monFriKeys.length} days at min ${DEMO_WEEKDAY_MIN}`,
		);
	}

	const weekdayCounts = allocateRandomWeekdayCounts(
		monFriKeys.length,
		weekdayBudget,
		DEMO_WEEKDAY_MIN,
		seed,
	);
	seededShuffle(weekdayCounts, seed);

	const targets = new Map<string, number>();
	for (const [index, key] of sundayKeys.entries()) {
		targets.set(key, sundayCounts[index]);
	}
	for (const [index, key] of saturdayKeys.entries()) {
		targets.set(key, saturdayCounts[index]);
	}
	for (const [index, key] of monFriKeys.entries()) {
		targets.set(key, weekdayCounts[index]);
	}

	for (const key of gridKeys) {
		const base = baseByDay.get(key) ?? 0;
		if (base > (targets.get(key) ?? 0)) {
			targets.set(key, base);
		}
	}

	rebalanceHeatmapTargets(targets, gridKeys, baseByDay, totalTarget);
	return targets;
}

function roundToQuarterHour(minutes: number): number {
	return Math.round(minutes / 15) * 15;
}

function formatLocalDateTime(date: string, minutesFromMidnight: number): string {
	const h = Math.floor(minutesFromMidnight / 60);
	const m = minutesFromMidnight % 60;
	return `${date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
}

/** Local wall time on `date` (YYYY-MM-DD) → ISO UTC. */
export function localDayTimeToIso(date: string, minutesFromMidnight: number): string {
	return new Date(formatLocalDateTime(date, minutesFromMidnight)).toISOString();
}

export function pickDemoTaskWindow(date: string, seed: number): {
	windowStartAt: string;
	windowEndAt: string;
} {
	const roll = seedMix(seed, 1) % 100;
	let startMin: number;
	let endMin: number;

	if (roll < 10) {
		const durationMin = (2 + (seedMix(seed, 2) % 6)) * 60;
		const dayStart = 6 * 60;
		const dayEnd = 21 * 60;
		const maxStart = dayEnd - durationMin;
		startMin = roundToQuarterHour(
			dayStart + (seedMix(seed, 3) % (maxStart - dayStart + 1)),
		);
		endMin = startMin + durationMin;
	} else if (roll < 40) {
		startMin = roundToQuarterHour(
			(7 + (seedMix(seed, 4) % 6)) * 60 + (seedMix(seed, 5) % 4) * 15,
		);
		endMin = roundToQuarterHour(
			(15 + (seedMix(seed, 6) % 6)) * 60 + (seedMix(seed, 7) % 4) * 15,
		);
		if (endMin <= startMin + 120) {
			endMin = roundToQuarterHour(startMin + 120 + (seedMix(seed, 8) % 180));
		}
	} else {
		startMin = roundToQuarterHour(
			(8 + (seedMix(seed, 9) % 4)) * 60 + (seedMix(seed, 10) % 4) * 15,
		);
		endMin = roundToQuarterHour(
			(12 + (seedMix(seed, 11) % 4)) * 60 + (seedMix(seed, 12) % 4) * 15,
		);
		if (endMin <= startMin + 60) {
			endMin = roundToQuarterHour(Math.min(15 * 60, startMin + 120));
		}
		endMin = Math.min(endMin, 15 * 60 + 45);
	}

	return {
		windowStartAt: localDayTimeToIso(date, startMin),
		windowEndAt: localDayTimeToIso(date, endMin),
	};
}

export function dayOffsetFromFocus(focusDayKey: string, taskDayKey: string): number {
	const focus = parseCalendarDayKey(focusDayKey);
	const task = parseCalendarDayKey(taskDayKey);
	const ms = task.getTime() - focus.getTime();
	return Math.round(ms / 86400000);
}
