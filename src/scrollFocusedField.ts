function scrollBlockForFocusedField(el: HTMLElement): ScrollLogicalPosition {
	if (el.closest('.field-more-page')) {
		return 'nearest';
	}
	return 'center';
}

/** Scroll the focused control into view (shell pages; IME resize is native). */
export function scrollFocusedIntoView(): void {
	const el = document.activeElement;
	if (
		!(el instanceof HTMLElement) ||
		el === document.body ||
		el === document.documentElement
	) {
		return;
	}
	el.scrollIntoView({
		block: scrollBlockForFocusedField(el),
		inline: 'nearest',
	});
}
