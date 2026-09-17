export const PAGE_HEADER_WIDE_MIN_REM = 56;
export const PAGE_HEADER_TITLE_MIN_VIEWPORT_PX = 1200;

export type PageHeaderTitleLayout = 'stacked' | 'overlay' | 'split' | 'row';

export function pageHeaderTitleLayout(input: {
	headerWidth: number;
	rem: number;
	hasLeft: boolean;
	hasRight: boolean;
}): PageHeaderTitleLayout {
	const wide = input.headerWidth >= PAGE_HEADER_WIDE_MIN_REM * input.rem;
	if (!wide && input.hasLeft) return 'stacked';
	if (wide && input.hasLeft && input.hasRight) return 'split';
	if (wide && (input.hasLeft || input.hasRight)) return 'overlay';
	return 'row';
}

function slotsAndTitleFit(input: {
	headerWidth: number;
	titleWidth: number;
	leftWidth: number;
	rightWidth: number;
	gap: number;
}): boolean {
	const gapCount =
		(input.leftWidth > 0 ? 1 : 0) + (input.rightWidth > 0 ? 1 : 0);
	return (
		input.leftWidth +
			input.titleWidth +
			input.rightWidth +
			input.gap * gapCount <=
		input.headerWidth + 0.5
	);
}

/** True when the full title can sit in the header without clipping. */
export function pageHeaderTitleFits(input: {
	headerWidth: number;
	titleWidth: number;
	leftWidth: number;
	rightWidth: number;
	gap: number;
	layout: PageHeaderTitleLayout;
	viewportWidth: number;
}): boolean {
	const {
		headerWidth,
		titleWidth,
		leftWidth,
		rightWidth,
		gap,
		layout,
		viewportWidth,
	} = input;
	if (viewportWidth < PAGE_HEADER_TITLE_MIN_VIEWPORT_PX) return false;
	if (titleWidth <= 0) return true;
	if (titleWidth > headerWidth + 0.5) return false;
	if (layout === 'stacked') return true;

	if (layout === 'overlay') {
		const center = headerWidth / 2;
		const titleLeft = center - titleWidth / 2;
		const titleRight = center + titleWidth / 2;
		if (leftWidth > 0 && titleLeft < leftWidth + gap - 0.5) return false;
		if (
			rightWidth > 0 &&
			titleRight > headerWidth - rightWidth - gap + 0.5
		) {
			return false;
		}
		return true;
	}

	return slotsAndTitleFit({
		headerWidth,
		titleWidth,
		leftWidth,
		rightWidth,
		gap,
	});
}
