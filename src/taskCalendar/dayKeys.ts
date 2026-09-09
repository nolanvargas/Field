export const MONTH_SHORT = [
	'Jan',
	'Feb',
	'Mar',
	'Apr',
	'May',
	'Jun',
	'Jul',
	'Aug',
	'Sep',
	'Oct',
	'Nov',
	'Dec',
] as const;

export const MONTH_LONG = [
	'January',
	'February',
	'March',
	'April',
	'May',
	'June',
	'July',
	'August',
	'September',
	'October',
	'November',
	'December',
] as const;

export const WEEKDAY_SHORT = [
	'Sun',
	'Mon',
	'Tue',
	'Wed',
	'Thu',
	'Fri',
	'Sat',
] as const;

/** Local calendar day key YYYY-MM-DD for stable compare/select. */
export function localDayKey(d: Date): string {
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function dayKeyFromIso(iso: string | null): string | null {
	if (!iso) return null;
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return null;
	return localDayKey(d);
}

export function parseDayKey(key: string): Date {
	const [y, m, d] = key.split('-').map(Number);
	return new Date(y, m - 1, d);
}

export function addDays(key: string, delta: number): string {
	const d = parseDayKey(key);
	d.setDate(d.getDate() + delta);
	return localDayKey(d);
}

/** Sunday-start week containing the given day. */
export function startOfWeek(key: string): string {
	const d = parseDayKey(key);
	d.setDate(d.getDate() - d.getDay());
	return localDayKey(d);
}

export function weekDayKeys(weekStartKey: string): string[] {
	const keys: string[] = [];
	for (let i = 0; i < 7; i++) {
		keys.push(addDays(weekStartKey, i));
	}
	return keys;
}

export type MonthGridDay = {
	key: string;
	inMonth: boolean;
};

/** 6-week Sun-start grid covering the month of `focusDayKey`. */
export function monthGridDays(focusDayKey: string): MonthGridDay[] {
	const focus = parseDayKey(focusDayKey);
	const year = focus.getFullYear();
	const month = focus.getMonth();
	const firstOfMonth = new Date(year, month, 1);
	const gridStart = new Date(firstOfMonth);
	gridStart.setDate(gridStart.getDate() - gridStart.getDay());

	const cells: MonthGridDay[] = [];
	for (let i = 0; i < 42; i++) {
		const d = new Date(gridStart);
		d.setDate(gridStart.getDate() + i);
		cells.push({
			key: localDayKey(d),
			inMonth: d.getMonth() === month,
		});
	}
	return cells;
}

export function addMonths(key: string, delta: number): string {
	const d = parseDayKey(key);
	const day = d.getDate();
	d.setMonth(d.getMonth() + delta);
	// Clamp if month rolled (e.g. Jan 31 + 1 month)
	if (d.getDate() !== day) {
		d.setDate(0);
	}
	return localDayKey(d);
}

function clampToMonth(year: number, monthIndex: number, day: number): string {
	const lastDay = new Date(year, monthIndex + 1, 0).getDate();
	return localDayKey(new Date(year, monthIndex, Math.min(day, lastDay)));
}

export function withMonth(key: string, monthIndex: number): string {
	const d = parseDayKey(key);
	return clampToMonth(d.getFullYear(), monthIndex, d.getDate());
}

export function withYear(key: string, year: number): string {
	const d = parseDayKey(key);
	return clampToMonth(year, d.getMonth(), d.getDate());
}

/** Descending years from next calendar year (`now` + 1) down to 2026. */
export function calendarYearOptions(now = new Date(), includeYear?: number): number[] {
	const current = now.getFullYear();
	const maxYear = Math.max(current + 1, includeYear ?? current + 1);
	const minYear = 2026;
	const years: number[] = [];
	for (let y = maxYear; y >= minYear; y -= 1) {
		years.push(y);
	}
	return years;
}

export function formatPickedDayLabel(key: string): string {
	const day = parseDayKey(key);
	return `${WEEKDAY_SHORT[day.getDay()]} ${MONTH_SHORT[day.getMonth()]} ${day.getDate()}`;
}

export function formatWeekLabel(weekStartKey: string): string {
	const start = parseDayKey(weekStartKey);
	return `Week of ${WEEKDAY_SHORT[start.getDay()]} ${MONTH_SHORT[start.getMonth()]} ${start.getDate()}`;
}

export function isSameLocalDay(iso: string | null, day: Date): boolean {
	if (!iso) return false;
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return false;
	return (
		d.getFullYear() === day.getFullYear() &&
		d.getMonth() === day.getMonth() &&
		d.getDate() === day.getDate()
	);
}
