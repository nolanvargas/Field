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
