import { contrastTextOn } from '../../shared/orgAccent.js';

const HEAT_DISPLAY_FLOOR = 0.18;
const HEAT_DISPLAY_GAMMA = 0.7;

function mixHex(a: string, b: string, t: number): string {
	const parse = (hex: string) => {
		const n = parseInt(hex.slice(1), 16);
		return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
	};
	const toHex = (v: number) =>
		Math.round(Math.min(255, Math.max(0, v)))
			.toString(16)
			.padStart(2, '0');
	const A = parse(a);
	const B = parse(b);
	return `#${toHex(A.r + (B.r - A.r) * t)}${toHex(A.g + (B.g - A.g) * t)}${toHex(A.b + (B.b - A.b) * t)}`;
}

/** Blended month-cell background (matches tasks.css color-mix). */
export function heatmapCellBackground(
	heat: number,
	accentMuted: string,
	surfaceRaised: string,
): string {
	return mixHex(surfaceRaised, accentMuted, heat);
}

/** Foreground tokens for readable text on a heated month cell. */
export function heatmapCellContrastVars(
	heat: number,
	accentMuted: string,
	surfaceRaised: string,
): { '--task-cell-fg': string; '--task-cell-fg-muted': string } {
	const bg = heatmapCellBackground(heat, accentMuted, surfaceRaised);
	const fg = contrastTextOn(bg);
	return {
		'--task-cell-fg': fg,
		'--task-cell-fg-muted': mixHex(bg, fg, 0.72),
	};
}

/** Map task count to 0–1 heat level relative to min/max among in-month days. */
export function heatmapLevel(
	count: number,
	min: number,
	max: number,
): number {
	if (count <= 0 || max <= 0) return 0;
	if (max === min) return 1;
	return (count - min) / (max - min);
}

/** Heat level for month-cell background: non-zero floor + gamma for visible saturation. */
export function heatmapDisplayLevel(
	count: number,
	min: number,
	max: number,
): number {
	if (count <= 0) return 0;
	const level = heatmapLevel(count, min, max);
	const curved = level ** HEAT_DISPLAY_GAMMA;
	return Math.min(1, HEAT_DISPLAY_FLOOR + (1 - HEAT_DISPLAY_FLOOR) * curved);
}

export function heatmapMinMax(
	counts: readonly number[],
	inMonthOnly: readonly boolean[],
): { min: number; max: number } {
	let min = Number.POSITIVE_INFINITY;
	let max = 0;
	for (let i = 0; i < counts.length; i++) {
		if (!inMonthOnly[i]) continue;
		const c = counts[i];
		if (c > max) max = c;
		if (c > 0 && c < min) min = c;
	}
	if (!Number.isFinite(min)) min = 0;
	return { min, max };
}
